
#include "rt0s_cc26x2.h"
#include "hw.h"
#include "gen_mqtt.h"
#include "hdlc.h"
#include <stdlib.h>
#include <string.h>

void rt0s_log(char *data) {
    char buf[199];
    mqttsn_encode_log(buf, sizeof(buf), 1, strlen(data), (unsigned char*)data);
}

void mqttsn_sender(int len, unsigned char* buf)
{
  unsigned char obuf[100];
  int olen = HDLC_encode(len, (void *)buf, 100, (void *)obuf);
  for (int i = 0; i < olen; i++)
    rt0s_putch(obuf[i]);
}

void mqttsn_decoded_ping(unsigned int seq, unsigned char data_len, unsigned char *data)
{
  char buf[100];
  data[0] = '*';
  mqttsn_encode_pong(buf, sizeof(buf), seq, data_len, (void *)data);
};
#define MAX_WATCH 16

struct watch_t {
    uint32_t address;
    uint8_t len;
    uint8_t size;
    int last_tick;
    uint8_t period;
    uint8_t old[16*4];
};

struct watch_t watches[MAX_WATCH];
extern int xtick;

void clear_watches() {
  for (int i = 0; i < MAX_WATCH; i++ )
    watches[i].address = 0;
}

void poll_watches() {
  char buf[100];
  for (int i = 0; i < MAX_WATCH; i++ ) {
    if (watches[i].address) {
      if (watches[i].period + watches[i].last_tick > xtick)
          continue;
      watches[i].last_tick = xtick;
      switch (watches[i].size)
      {
      case 1:
        {
          uint8_t data[64], *dp = (void *)watches[i].address, *op = (void *)watches[i].old;
          char changed = 0;
          for (int j = 0; j < watches[i].len; j++) {
            if (op[j] != dp[j])
              changed = 1;
            data[j] = dp[j];
            op[j] = dp[j];
          }
          if (changed)
            mqttsn_encode_read8ack(buf, sizeof(buf), 0, watches[i].len, data, i);
        }
        break;
      case 2:
        {
          uint16_t data[64], *dp = (void *)watches[i].address, *op = (void *)watches[i].old;
          char changed = 0;
          for (int j = 0; j < watches[i].len; j++) {
            if (op[j] != dp[j])
              changed = 1;
            data[j] = dp[j];
            op[j] = dp[j];
          }
          if (changed)
            mqttsn_encode_read16ack(buf, sizeof(buf), 0, watches[i].len, data, i);
        }
        break;
      case 4:
        {
          unsigned int data[64], *dp = (void *)watches[i].address, *op = (void *)watches[i].old;
          char changed = 0;
          for (int j = 0; j < watches[i].len; j++) {
            if (op[j] != dp[j])
              changed = 1;
            data[j] = dp[j];
            op[j] = dp[j];
          }
          if (changed)
            mqttsn_encode_read32ack(buf, sizeof(buf), 0, watches[i].len, data, i);
        }
        break;

      default:
        break;
      }
    }
  }
}

void mqttsn_decoded_read8(unsigned int seq, unsigned int address, unsigned char len, unsigned char watch_index, unsigned char watch_period)
{
  (void)watch_index;
  char buf[100];
  if (watch_index) {
    watches[watch_index].address = address;
    watches[watch_index].len = len;
    watches[watch_index].size = 1;
    watches[watch_index].period = watch_period + 1;
    watches[watch_index].last_tick = xtick;
  }
  unsigned char data[64], *dp = (void*)address, *op = (void *)watches[watch_index].old;
  if (len > 64)
      len = 64;
  for (int i = 0; i < len; i++)
      op[i] = data[i] = dp[i];
  mqttsn_encode_read8ack(buf, sizeof(buf), seq, len, data, 0);
}

void mqttsn_decoded_read16(unsigned int seq, unsigned int address, unsigned char len, unsigned char watch_index, unsigned char watch_period)
{
  (void)watch_index;
  char buf[100];
  if (watch_index) {
    watches[watch_index].address = address;
    watches[watch_index].len = len;
    watches[watch_index].size = 2;
    watches[watch_index].period = watch_period + 1;
    watches[watch_index].last_tick = xtick;
  }
  unsigned short int data[64], *dp = (void *)address, *op = (void *)watches[watch_index].old;
  if (len > 64)
    len = 64;
  for (int i = 0; i < len; i++)
    op[i] = data[i] = dp[i];
  mqttsn_encode_read16ack(buf, sizeof(buf), seq, len, data, 0);
}

void mqttsn_decoded_read32(unsigned int seq, unsigned int address, unsigned char len, unsigned char watch_index, unsigned char watch_period)
{
  (void)watch_index;
  char buf[100];
  if (watch_index) {
    watches[watch_index].address = address;
    watches[watch_index].len = len;
    watches[watch_index].size = 4;
    watches[watch_index].period = watch_period + 1;
    watches[watch_index].last_tick = xtick;
  }
  unsigned int data[64], *dp = (void *)address, *op = (void *)watches[watch_index].old;
  if (len > 64)
    len = 64;
  for (int i = 0; i < len; i++)
    op[i] = data[i] = dp[i];

  mqttsn_encode_read32ack(buf, sizeof(buf), seq, len, data, 0);
}

void mqttsn_decoded_write8(unsigned int seq, unsigned int address, unsigned char data_len, unsigned char *data)
{
  char buf[100];
  unsigned char *dp = (void *)address;
  for (int i = 0; i < data_len; i++)
    dp[i] = data[i];
  mqttsn_encode_write_ack(buf, sizeof(buf), seq, 1);
}

void mqttsn_decoded_write16(unsigned int seq, unsigned int address, unsigned char data_len, unsigned int *data)
{
  char buf[100];
  volatile unsigned short int *dp = (void *)address;
  for (int i = 0; i < data_len; i++)
    dp[i] = data[i];
  mqttsn_encode_write_ack(buf, sizeof(buf), seq, 2) ;
}

void mqttsn_decoded_write32(unsigned int seq, unsigned int address, unsigned char data_len, unsigned int *data)
{
  char buf[100];
  volatile unsigned int *dp = (void *)address;
  for (int i = 0; i < data_len; i++)
    dp[i] = data[i];
  mqttsn_encode_write_ack(buf, sizeof(buf), seq, 3);
}

unsigned int calls = 1;
unsigned int calla = 1;

void mqttsn_decoded_call(unsigned int seq, unsigned int address, unsigned int arg0, unsigned int arg1, unsigned int arg2, unsigned int arg3) {
  calla = address;
  char buf[100];
  int (*fun_ptr)(unsigned int arg0, unsigned int arg1, unsigned int arg2, unsigned int arg3) = (void *)address;
  int ret = (*fun_ptr)(arg0, arg1, arg2, arg3);
  mqttsn_encode_callack(buf, sizeof(buf), seq, ret);
};
