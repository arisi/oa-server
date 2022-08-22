  /*
   * CC2652 Startup
   */

  .syntax unified
  .fpu softvfp
  .thumb

  .global g_pfnVectors
  .global Default_Handler
  .word _sidata
  .word _sdata
  .word _edata
  .word _sbss
  .word _ebss
  .word _sheap

  .section .text.Reset_Handler
  .weak Reset_Handler
  .type Reset_Handler, %function

Reset_Handler:
  ldr   r0, =_estack
  mov   sp, r0
  bl    main

/* Copy the data segment initializers from flash to SRAM */
  ldr r0, =_sdata
  ldr r1, =_edata
  ldr r2, =_sidata
  movs r3, #0
  b LoopCopyDataInit

CopyDataInit:
  ldr r4, [r2, r3]
  str r4, [r0, r3]
  adds r3, r3, #4

LoopCopyDataInit:
  adds r4, r0, r3
  cmp r4, r1
  bcc CopyDataInit

/* Zero fill the bss segment. */
  ldr r2, =_sbss
  ldr r4, =_ebss
  movs r3, #0
  b LoopFillZerobss

FillZerobss:
  str  r3, [r2]
  adds r2, r2, #4

LoopFillZerobss:
  cmp r2, r4
  bcc FillZerobss

/* Call the application's entry point.*/
  bl main

LoopForever:
  bl    main
  b LoopForever

  .size Reset_Handler, .-Reset_Handler

  .section .text.Default_Handler,"ax",%progbits

Default_Handler:
Infinite_Loop:
  bl    main
  b Infinite_Loop
  .size Default_Handler, .-Default_Handler

  .section .isr_vector,"a",%progbits
  .type g_pfnVectors, %object
  .size g_pfnVectors, .-g_pfnVectors


g_pfnVectors:
  .word  _estack
  .word  Reset_Handler
  .word  NMI_Handler
  .word  HardFault_Handler
  .word  BusFault_Handler
  .word  UsageFault_Handler
  .word  0
  .word  0
  .word  0
  .word  0
  .word  0
  .word  SVC_Handler
  .word  DebugMon_Handler
  .word  0
  .word  PendSV_Handler
  .word  SysTick_Handler
  .word  IRQ0_Handler
  .word  IRQ1_Handler
  .word  IRQ2_Handler
  .word  IRQ3_Handler
  .word  IRQ4_Handler
  .word  IRQ5_Handler
  .word  IRQ6_Handler
  .word  IRQ7_Handler
  .word  IRQ8_Handler
  .word  IRQ9_Handler
  .word  IRQ10_Handler
  .word  IRQ11_Handler
  .word  IRQ12_Handler
  .word  IRQ13_Handler
  .word  IRQ14_Handler
  .word  IRQ15_Handler
  .word  IRQ16_Handler
  .word  IRQ17_Handler
  .word  IRQ18_Handler
  .word  IRQ19_Handler
  .word  IRQ20_Handler
  .word  IRQ21_Handler
  .word  IRQ22_Handler
  .word  IRQ23_Handler
  .word  IRQ24_Handler
  .word  IRQ25_Handler
  .word  IRQ26_Handler
  .word  IRQ27_Handler
  .word  IRQ28_Handler
  .word  IRQ29_Handler
  .word  IRQ30_Handler
  .word  IRQ31_Handler
  .word  IRQ32_Handler
  .word  IRQ33_Handler
  .word  IRQ34_Handler
  .word  IRQ35_Handler
  .word  IRQ36_Handler
  .word  IRQ37_Handler
  .word  IRQ38_Handler
  .word  IRQ39_Handler
  .word  IRQ40_Handler
  .word  IRQ41_Handler
  .word  IRQ42_Handler
  .word  IRQ43_Handler
  .word  IRQ44_Handler
  .word  IRQ45_Handler
  .word  IRQ46_Handler
  .word  IRQ47_Handler
  .word  IRQ48_Handler
  .word  IRQ49_Handler
  .word  IRQ50_Handler
  .word  IRQ51_Handler
  .word  IRQ52_Handler
  .word  IRQ53_Handler
  .word  IRQ54_Handler
  .word  IRQ55_Handler
  .word  IRQ56_Handler
  .word  IRQ57_Handler
  .word  IRQ58_Handler
  .word  IRQ59_Handler

  .weak      NMI_Handler
  .thumb_set NMI_Handler,Default_Handler

  .weak      HardFault_Handler
  .thumb_set HardFault_Handler,Default_Handler

  .weak      SVC_Handler
  .thumb_set SVC_Handler,Default_Handler

  .weak      PendSV_Handler
  .thumb_set PendSV_Handler,Default_Handler

  .weak      SysTick_Handler
  .thumb_set SysTick_Handler,Default_Handler

  .weak      BusFault_Handler
  .thumb_set BusFault_Handler,Default_Handler

  .weak      UsageFault_Handler
  .thumb_set UsageFault_Handler,Default_Handler

  .weak      DebugMon_Handler
  .thumb_set DebugMon_Handler,Default_Handler

  .weak      IRQ0_Handler
  .thumb_set IRQ0_Handler,Default_Handler

  .weak      IRQ1_Handler
  .thumb_set IRQ1_Handler,Default_Handler

  .weak      IRQ2_Handler
  .thumb_set IRQ2_Handler,Default_Handler

  .weak      IRQ3_Handler
  .thumb_set IRQ3_Handler,Default_Handler

  .weak      IRQ4_Handler
  .thumb_set IRQ4_Handler,Default_Handler

  .weak      IRQ5_Handler
  .thumb_set IRQ5_Handler,Default_Handler

  .weak      IRQ6_Handler
  .thumb_set IRQ6_Handler,Default_Handler

  .weak      IRQ7_Handler
  .thumb_set IRQ7_Handler,Default_Handler

  .weak      IRQ8_Handler
  .thumb_set IRQ8_Handler,Default_Handler

  .weak      IRQ9_Handler
  .thumb_set IRQ9_Handler,Default_Handler

  .weak      IRQ10_Handler
  .thumb_set IRQ10_Handler,Default_Handler

  .weak      IRQ11_Handler
  .thumb_set IRQ11_Handler,Default_Handler

  .weak      IRQ12_Handler
  .thumb_set IRQ12_Handler,Default_Handler

  .weak      IRQ13_Handler
  .thumb_set IRQ13_Handler,Default_Handler

  .weak      IRQ14_Handler
  .thumb_set IRQ14_Handler,Default_Handler

  .weak      IRQ15_Handler
  .thumb_set IRQ15_Handler,Default_Handler

  .weak      IRQ16_Handler
  .thumb_set IRQ16_Handler,Default_Handler

  .weak      IRQ17_Handler
  .thumb_set IRQ17_Handler,Default_Handler

  .weak      IRQ18_Handler
  .thumb_set IRQ18_Handler,Default_Handler

  .weak      IRQ19_Handler
  .thumb_set IRQ19_Handler,Default_Handler

  .weak      IRQ20_Handler
  .thumb_set IRQ20_Handler,Default_Handler

  .weak      IRQ21_Handler
  .thumb_set IRQ21_Handler,Default_Handler

  .weak      IRQ22_Handler
  .thumb_set IRQ22_Handler,Default_Handler

  .weak      IRQ23_Handler
  .thumb_set IRQ23_Handler,Default_Handler

  .weak      IRQ24_Handler
  .thumb_set IRQ24_Handler,Default_Handler

  .weak      IRQ25_Handler
  .thumb_set IRQ25_Handler,Default_Handler

  .weak      IRQ26_Handler
  .thumb_set IRQ26_Handler,Default_Handler

  .weak      IRQ27_Handler
  .thumb_set IRQ27_Handler,Default_Handler

  .weak      IRQ28_Handler
  .thumb_set IRQ28_Handler,Default_Handler

  .weak      IRQ29_Handler
  .thumb_set IRQ29_Handler,Default_Handler

  .weak      IRQ30_Handler
  .thumb_set IRQ30_Handler,Default_Handler

  .weak      IRQ31_Handler
  .thumb_set IRQ31_Handler,Default_Handler

  .weak      IRQ32_Handler
  .thumb_set IRQ32_Handler,Default_Handler

  .weak      IRQ33_Handler
  .thumb_set IRQ33_Handler,Default_Handler

  .weak      IRQ34_Handler
  .thumb_set IRQ34_Handler,Default_Handler

  .weak      IRQ35_Handler
  .thumb_set IRQ35_Handler,Default_Handler

  .weak      IRQ36_Handler
  .thumb_set IRQ36_Handler,Default_Handler

  .weak      IRQ37_Handler
  .thumb_set IRQ37_Handler,Default_Handler

  .weak      IRQ38_Handler
  .thumb_set IRQ38_Handler,Default_Handler

  .weak      IRQ39_Handler
  .thumb_set IRQ39_Handler,Default_Handler

  .weak      IRQ30_Handler
  .thumb_set IRQ30_Handler,Default_Handler

  .weak      IRQ31_Handler
  .thumb_set IRQ31_Handler,Default_Handler

  .weak      IRQ32_Handler
  .thumb_set IRQ32_Handler,Default_Handler

  .weak      IRQ33_Handler
  .thumb_set IRQ33_Handler,Default_Handler

  .weak      IRQ34_Handler
  .thumb_set IRQ34_Handler,Default_Handler

  .weak      IRQ35_Handler
  .thumb_set IRQ35_Handler,Default_Handler

  .weak      IRQ36_Handler
  .thumb_set IRQ36_Handler,Default_Handler

  .weak      IRQ37_Handler
  .thumb_set IRQ37_Handler,Default_Handler

  .weak      IRQ38_Handler
  .thumb_set IRQ38_Handler,Default_Handler

  .weak      IRQ39_Handler
  .thumb_set IRQ39_Handler,Default_Handler

  .weak      IRQ40_Handler
  .thumb_set IRQ40_Handler,Default_Handler

  .weak      IRQ41_Handler
  .thumb_set IRQ41_Handler,Default_Handler

  .weak      IRQ42_Handler
  .thumb_set IRQ42_Handler,Default_Handler

  .weak      IRQ43_Handler
  .thumb_set IRQ43_Handler,Default_Handler

  .weak      IRQ44_Handler
  .thumb_set IRQ44_Handler,Default_Handler

  .weak      IRQ45_Handler
  .thumb_set IRQ45_Handler,Default_Handler

  .weak      IRQ46_Handler
  .thumb_set IRQ46_Handler,Default_Handler

  .weak      IRQ47_Handler
  .thumb_set IRQ47_Handler,Default_Handler

  .weak      IRQ48_Handler
  .thumb_set IRQ48_Handler,Default_Handler

  .weak      IRQ49_Handler
  .thumb_set IRQ49_Handler,Default_Handler

  .weak      IRQ50_Handler
  .thumb_set IRQ50_Handler,Default_Handler

  .weak      IRQ51_Handler
  .thumb_set IRQ51_Handler,Default_Handler

  .weak      IRQ52_Handler
  .thumb_set IRQ52_Handler,Default_Handler

  .weak      IRQ53_Handler
  .thumb_set IRQ53_Handler,Default_Handler

  .weak      IRQ54_Handler
  .thumb_set IRQ54_Handler,Default_Handler

  .weak      IRQ55_Handler
  .thumb_set IRQ55_Handler,Default_Handler

  .weak      IRQ56_Handler
  .thumb_set IRQ56_Handler,Default_Handler

  .weak      IRQ57_Handler
  .thumb_set IRQ57_Handler,Default_Handler

  .weak      IRQ58_Handler
  .thumb_set IRQ58_Handler,Default_Handler

  .weak      IRQ59_Handler
  .thumb_set IRQ59_Handler,Default_Handler

