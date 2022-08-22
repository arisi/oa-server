#include "init.h"
#include "hw.h"

void delay()
{
  volatile int x;
  for (x = 0; x < 1000000; x++)
    ;
}

//volatile uint32_t *PDCTL0SERIAL = (uint32_t *)(PRCM + 0x134);
//volatile uint32_t *PDCTL0PERIPH = (uint32_t *)(PRCM + 0x138);

//volatile uint32_t *DOE31_0 = (uint32_t *)(GPIO + 0xD0);
//volatile uint32_t *DOUT31_0 = (uint32_t *)(GPIO + 0x80);
// volatile uint32_t *STAT0 = (uint32_t *)(PRCM + 0x3c);
//volatile uint32_t *GPIOCLKGR = (uint32_t *)(PRCM + 0x48);
//volatile uint32_t *UARTCLKGR = (uint32_t *)(PRCM + 0x6C);

//volatile uint32_t *CLKLOADCTL = (uint32_t *)(PRCM + 0x28);
//volatile uint32_t *PDSTAT0 = (uint32_t *)(PRCM + 0x140);

// volatile uint32_t *IOCFG0 = (uint32_t *)(IOC + 0x00);
// volatile uint32_t *IOCFG1 = (uint32_t *)(IOC + 0x04);
//volatile uint32_t *IOCFG2 = (uint32_t *)(IOC + 0x08);
//volatile uint32_t *IOCFG3 = (uint32_t *)(IOC + 0x0C);
// volatile uint32_t *IOCFG4 = (uint32_t *)(IOC + 0x10);
// volatile uint32_t *IOCFG5 = (uint32_t *)(IOC + 0x14);
//volatile uint32_t *IOCFG6 = (uint32_t *)(IOC + 0x18);
//volatile uint32_t *IOCFG7 = (uint32_t *)(IOC + 0x1C);

/*
volatile uint32_t *DR0 = (uint32_t *)(UART0 + 0x00);
volatile uint32_t *IBRD0 = (uint32_t *)(UART0 + 0x24);
volatile uint32_t *FBRD0 = (uint32_t *)(UART0 + 0x28);
volatile uint32_t *LCRH0 = (uint32_t *)(UART0 + 0x2C);
volatile uint32_t *CTL0 = (uint32_t *)(UART0 + 0x30);
*/

int init()
{

  PRCM->GPIOCLKGR = 0x11;
  PRCM->UARTCLKGR = 0x11;

  IOC6->IOCFG = 0x00006000;
  IOC7->IOCFG = 0x00006000;
  // UART
  IOC2->IOCFG = 0x0000600F;
  IOC3->IOCFG = 0x00006010;

  PRCM->PDCTL0PERIPH = 0x1;
  while (!(PRCM->PDSTAT & 0x04)) // check PERIPH_ON is on
    ;

  PRCM->PDCTL0SERIAL = 0x1;
  while (!(PRCM->PDSTAT & 0x02)) // check SERIAL_ON is on
    ;

  PRCM->CLKLOADCTL = 1;              // do load
  while (!(PRCM->CLKLOADCTL & 0x02)) // check LOAD_DONE is on
    ;

  UART0->CTL = 0x000;
  UART0->IBRD = 26;
  UART0->FBRD = 0x0f;
  UART0->LCRH = 0x60;
  UART0->CTL = 0x301;

  GPIO->DOE31_0 = 0xc0;
  return 0;
}