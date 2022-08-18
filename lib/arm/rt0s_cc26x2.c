
#include "rt0s_cc26x2.h"
#include "debugger.h"
#include "gen_mqtt.h"
#include "hdlc.h"
#include "hw.h"
#include <stdlib.h>
#include <string.h>

#define USE_UART0

void frame(int len, unsigned char* buf)
{
    mqttsn_decode(len, buf);
}

void rt0s_poll()
{
#ifdef USE_UART0
    // UART0->ECR = 0;
    if ((UART0->FR & 0x10) == 0)
#else
    UART0->ECR = 0;
    if ((UART1->FR & 0x10) == 0)
#endif
    {
        char ch = UART0->DATA;
        HDLC_decode(ch, frame);
    }
}
void delay()
{
    volatile int x;
    for (x = 0; x < 100000; x++)
        rt0s_poll();
}

void rt0s_init()
{
    clear_watches();
    // PRCM->GPIOCLKGR = 0x11;

    // IOC6->IOCFG = 0x00006000;
    // IOC7->IOCFG = 0x00006000;
#ifdef USE_UART0
    IOC2->IOCFG = 0x2000600F;
    IOC3->IOCFG = 0x00006010;
#else
    IOC4->IOCFG     = 0x00006013; // RX UART1
    IOC5->IOCFG     = 0x00006014; // TX UART1
#endif
    // PRCM->PDCTL0RFC = 0x1;
    // while (!(PRCM->PDSTAT & 0x01)) // check RFC_ON is on
    //     ;

    // PRCM->PDCTL0PERIPH = 0x1;

    // while (!(PRCM->PDSTAT & 0x04)) // check PERIPH_ON is on
    //     ;

    PRCM->PDCTL0SERIAL = 0x1;
    while (!(PRCM->PDSTAT0 & 0x02)) // check SERIAL_ON is on
        ;

#ifdef USE_UART0
    PRCM->UARTCLKGR = 0x11;
#else
    PRCM->UARTCLKGR = 0x22;
#endif
    PRCM->CLKLOADCTL = 1;              // do load UART
    while (!(PRCM->CLKLOADCTL & 0x02)) // check LOAD_DONE is on
        ;
#ifdef USE_UART0
    UART0->CTL  = 0x000;
    UART0->IBRD = 26;
    UART0->FBRD = 0x0f;
    UART0->LCRH = 0x60;
    UART0->CTL  = 0x301;
#else

    UART1->CTL  = 0x000;
    UART1->IBRD = 26;
    UART1->FBRD = 0x0f;
    UART1->LCRH = 0x60;
    UART1->CTL  = 0x301;
#endif
    // GPIO->DOE31_0 = 0xc0;
    /*GPIO->DOE31_0 = 0xe3;

    GPIO->DOUT31_0 = 0xc0;
    delay();
    GPIO->DOUT31_0 = 0x0;
    delay();*/
}

void rt0s_putch(char ch)
{
#ifdef USE_UART0
    while (UART0->FR & 0x20)
        rt0s_poll();
    UART0->DATA = ch;
#else
    while (UART1->FR & 0x20)
        rt0s_poll();
    UART1->DATA = ch;
#endif
    // rt0s_sbyte(ch);
}
void rt0s_flush()
{
#ifdef USE_UART0
    while (!(UART0->FR & 0x80))
        ;
#else
    while (!(UART1->FR & 0x80))
        ;
#endif
}

void rt0s_puts(char* s)
{
    while (*s)
        rt0s_putch(*s);
    rt0s_flush();
}

void i2hex(char* buf, int len, int v)
{
    for (int i = 0; i < len; i++)
    {
        int vv = v >> (4 * (len - i - 1));
        vv &= 0x0f;
        if (vv < 10)
            buf[i] = '0' + vv;
        else
            buf[i] = 'A' + vv - 10;
    }
}

void rt0s_logn(int v)
{
    char b[10];
    i2hex(b, 8, v);
    b[8] = '\n';
    b[9] = 0;
    rt0s_log(b);
}

void rt0s_logb(int len, char* data)
{
    char b[199];
    for (int i = 0; i < len; i++)
    {
        i2hex(&b[i * 3], 2, data[i]);
        b[i * 3 + 2] = ',';
        b[i * 3 + 3] = '\n';
        b[i * 3 + 4] = 0;
    }
    rt0s_log(b);
}

void rt0s_dump(char* buf, int len)
{
    char b[3];
    rt0s_puts("<");
    i2hex(b, 2, len);
    b[2] = 0;
    rt0s_puts((void*)b);
    rt0s_puts(":");
    for (int i = 0; i < len; i++)
    {
        if (i)
            rt0s_puts(",");
        i2hex(b, 2, buf[i]);
        b[2] = 0;
        rt0s_puts((void*)b);
    }
    rt0s_puts(">");
}

void rt0s_dumpw(char* buf, int len)
{
    char b[3];
    rt0s_puts("<");
    i2hex(b, 2, len);
    b[2] = 0;
    rt0s_puts((void*)b);
    rt0s_puts(":");
    for (int i = 0; i < len; i += 4)
    {
        if (i)
            rt0s_puts(",");
        i2hex(b, 2, buf[i + 3]);
        rt0s_puts((void*)b);
        i2hex(b, 2, buf[i + 2]);
        rt0s_puts((void*)b);
        i2hex(b, 2, buf[i + 1]);
        rt0s_puts((void*)b);
        i2hex(b, 2, buf[i]);
        rt0s_puts((void*)b);
    }
    rt0s_puts(">");
}

static int tick = 0;
void ticker(int n)
{
    for (int i = 0; i < n; i++)
    {
        tick += 1;
        delay();
    }
}