
#pragma once

#include <stdint.h>

void ticker(int);
void rt0s_gpio(int);
void rt0s_puts(char*);
void rt0s_log(char*);
void rt0s_putch(char ch);
void rt0s_init();
void delay();
void rt0s_dump(char* buf, int len);
void rt0s_dumpw(char* buf, int len);
void poll_watches();
void rt0s_logn(int v);
void rt0s_logb(int len, char* data);