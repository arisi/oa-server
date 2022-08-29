*** Settings ***
Documentation  TI MCU Test
...
...            TI MCU Test

*** Settings ***
Library         rt0s_robot.py
Suite Setup     Rt0s Connect  mqtt://192.168.2.1:1884  arska  zilakka  robotti
Suite Teardown  Rt0s Disconnect

*** Variables ***

*** Test Cases ***
Init
    Rt0s Read Cpu   ../mban/gen.json5
    Rt0s Read Syms  /Users/503308648/syms.json
    Select Dut      dut2

Reset
    Reset

Ident
    ${Ident}=  Rt0s Ident
    Log  IDENT: ${Ident}  WARN

Check Radio Powering
    ${PDCTL0RFC}=  Rt0s Rreg  PRCM:PDCTL0RFC
    ${PDSTAT0}=    Rt0s Rreg  PRCM:PDSTAT0
    Log  PRCM:PDCTL0RFC: ${PDCTL0RFC}  WARN
    Log  PRCM:PDSTAT0: ${PDSTAT0}  WARN
    IF  ${PDSTAT0['RFC_ON0']} == 0
        Log  Turning RFC Main Module ON..  WARN
        Rt0s Wreg  PRCM:PDCTL0RFC  1
        WHILE  ${PDSTAT0['RFC_ON0']} == 0  limit=10
            Sleep  0.2s
            ${PDSTAT0}=  Rt0s Rreg  PRCM:PDSTAT0
        END
        IF  ${PDSTAT0['RFC_ON0']} == 0
            Fail  RFC IS NOT TURNING ON
        END
        Log  PRCM:PDSTAT0: ${PDSTAT0}  WARN
    END

Powering Up Radio SubModules
    WHILE    True
        Power Up
        Sleep  0.2s
        ${PWMCLKEN}=  Rt0s Rreg  RFCPWR:PWMCLKEN
        IF  ${PWMCLKEN['RAT']} == 1
            BREAK
        END
    END

CMD_BLE5_RADIO_SETUP
    ${ret}=  Rt0s Call  schedule_tx   # side effect: sets  whitening
    ${pOverridesCommonMban}=  Rt0s Get Sym  pOverridesCommonMban
    ${pOverrides1MbpsMban}=   Rt0s Get Sym  pOverrides1MbpsMban
    ${pOverrides2MbpsMban}=   Rt0s Get Sym  pOverrides2MbpsMban
    ${pOverridesCodedMban}=   Rt0s Get Sym  pOverridesCodedMban
    @{Overrides}=  create list   ${pOverridesCommonMban['a']}  ${pOverrides1MbpsMban['a']}  ${pOverrides2MbpsMban['a']}   ${pOverridesCodedMban['a']}

    Rt0s Clr Buf
    Rt0s Write Buf One  1  14  1
    Rt0s Write Buf One  2  18  0x7217  #tx power
    Rt0s Write Buf      4  20  ${Overrides}
    Rt0s Cmd  CMD_BLE5_RADIO_SETUP

    #Exit

CMD_FS
    Rt0s Clr Buf
    Rt0s Write Buf One  2  14  2362   #frequency
    Rt0s Write Buf One  1  18  1      #txmode as default
    Rt0s Cmd  CMD_FS

    #${RF_cmdFsMban}=   Rt0s Get Sym  RF_cmdFsMban
    #Rt0s Cmd Raw  ${RF_cmdFsMban['a']}


CMD_SYNC_START_RAT
    Rt0s Clr Buf
    Rt0s Cmd  CMD_SYNC_START_RAT

CMD_PROP_TX_ADV
    ${rftest_packet}=   Rt0s Get Sym  rftest_packet
    ${RF_cmdPropTxAdvMban}=   Rt0s Get Sym  RF_cmdPropTxAdvMban
    Rt0s Clr Buf
    Rt0s Write Buf One  1  14  32                  #bCrCIncHdr
    Rt0s Write Buf One  1  15  13                  #hdr len
    Rt0s Write Buf One  2  16  41                 #pkt len = payload+5
    Rt0s Write Buf One  4  24  0x89abcedf          #sync
    #Rt0s Write Buf One  4  28  0x020007900        #buf
    Rt0s Write Buf One  4  28  ${rftest_packet['a']}         #buf
    #Rt0s Write  1  ${rftest_packet['a']}  [ 2, 3, 3, 4, 5, 6, 7, 8 ]  #data
    #Rt0s Write  4  0x020007900  [ 0xabbab000 ]


    FOR  ${index}  IN RANGE  4
        Rt0s Write One  1  536879714  ${index}
        Rt0s Cmd  CMD_PROP_TX_ADV
        #Rt0s Cmd Raw  ${RF_cmdPropTxAdvMban['a']}
        Log to Console  Bare Metal Sent ${index}
        Sleep  0.1
    END

schedule_tx
    FOR  ${index}  IN RANGE  0
        #Rt0s Call  schedule_tx
        ${ret}=  Rt0s Call  schedule_tx
        Log to Console  schedule_tx ${index} : ${ret}
        Sleep  0.1
    END

*** Keywords ***

Power Up
    Rt0s Wreg  PRCM:RFCBITS     0xE0000039
    Rt0s Wreg  RFCPWR:PWMCLKEN  0x000007ff

Get Time
    ${TIME}=  Rt0s Rreg  AONRTC:TIME
    RETURN  ${${TIME['SEC_L']}+${TIME['SUBSEC_H']}/10000.0}

Reset
    Rt0s Wreg  CPUSCS:AIRCR  0x05fa0004  NoAck
    WHILE    True
        Sleep  10ms
        ${ind}=  Get Ind  log
        IF  ${ind} == True
            BREAK
        END
    END
    ${time}=  Get Time
    IF  ${time} < 2
        Log   Booted OK, Uptime: ${time}  WARN
    ELSE
        Fail  Not Booted, Uptime: ${time}
    END
