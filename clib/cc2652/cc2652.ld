SECTIONS {
  . = 0x00000000;

  .vector : { *(.isr_vector) }
  . = ALIGN(4);
  vec_end = . ;

  . = 0x00001000 ;
  .text : { *(.text .text.*) }
  . = ALIGN(4) ;
  text_end = . ;

  .rodata : { *(.rodata .rodata.*) }
  . = ALIGN(128) ;
  rodata_end = . ;

  . = ALIGN(256);
  _sidata = . ;

  . = 0x20001000;
  .data : AT (_sidata)
    {
      _sdata = . ;
      *(.data .data.*)
    }
  . = ALIGN(128);
  _edata = . ;

  .bss :
    {
      _sbss = . ;
      *(.bss .bss.*)
      *(COMMON)
      _ebss = . ;
    }
  . = ALIGN(128) ;

  _sheap = . ;
  _estack = 0x20013000;
}


