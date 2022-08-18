#pragma once

#define FRAME_OCTET 0x7E
#define ESCAPE_OCTET 0x7D
#define INVERT_OCTET 0x20

#define MAX_IN_BUF_SIZE 400

int HDLC_encode(int len, char *buf, int max_len, unsigned char *out_buf);
void HDLC_decode(unsigned char ch, void (*cb)(int len, unsigned char *buf));