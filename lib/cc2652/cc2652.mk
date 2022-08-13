FLAGS    = -mthumb -mcpu=cortex-m4 -mfloat-abi=soft
DEFINES  = -DCC2652 -D__ARM_ARCH_8M_BASE__ -DNOPLL
TEXT = 0x200
DATA =  0x20000000
STACK = 0x20014000

