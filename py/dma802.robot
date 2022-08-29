*** Settings ***
Documentation  Vaisala DMA802 Test
...
...            Vaisala DMA802 Test

*** Settings ***
Library         rt0s_robot.py
Suite Setup     Rt0s Connect  mqtt://192.168.2.1:1884  arska  zilakka  robotti
Suite Teardown  Rt0s Disconnect

*** Variables ***

*** Test Cases ***
Init
    #Rt0s Read Cpu   ../gen.json5
    #Rt0s Read Syms  ../syms.json
    Select Dut      MQTT:RA2E1:dma802-mcu:dma802.X0000

#Reset
#    Reset

#Ident
#    ${Ident}=  Rt0s Ident
#    Log  CPU: ${Ident['cpu']}  WARN
#    Log  FW : ${Ident['fw']}  WARN

Dump
  FOR  ${i}  IN RANGE  32
    ${d}=  Rt0s Read  1  ${32*${i}+32}  1
    Log  dump : ${d}  WARN
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
