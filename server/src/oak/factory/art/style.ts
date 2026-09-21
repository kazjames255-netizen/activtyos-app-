// Theme classes for the pictures (drawn inline, so they follow the app's light/dark CSS variables).
export const PIC_CSS = `
.pic{width:100%;height:auto;display:block;overflow:visible}
.pic .l{fill:none;stroke:var(--ink,#171534);stroke-width:2;stroke-linejoin:round;stroke-linecap:round}
.pic .h{fill:none;stroke:var(--ink-2,#4a4763);stroke-width:1.6;stroke-dasharray:5 4;stroke-linecap:round}
.pic .th{fill:none;stroke:var(--ink-3,#8a86a3);stroke-width:1;stroke-linecap:round}
.pic .th2{fill:none;stroke:var(--ink,#171534);stroke-width:1.5;stroke-linejoin:round}
.pic .a{fill:none;stroke:var(--brand-2,#2f6bd8);stroke-width:2.6;stroke-linejoin:round;stroke-linecap:round}
.pic .ar{fill:none;stroke:var(--red,#e21d27);stroke-width:2.6;stroke-linecap:round}
.pic .ag{fill:none;stroke:var(--green,#15b364);stroke-width:2.6;stroke-linecap:round}
.pic .ao{fill:none;stroke:var(--gold,#f5b81f);stroke-width:2.6;stroke-linecap:round}
.pic .hd{fill:var(--ink,#171534);stroke:none}.pic .hda{fill:var(--brand-2,#2f6bd8);stroke:none}.pic .hdr{fill:var(--red,#e21d27);stroke:none}.pic .hdg{fill:var(--green,#15b364);stroke:none}.pic .hdo{fill:var(--gold,#f5b81f);stroke:none}
.pic .f0{fill:var(--surface,#fff)}
.pic .f1{fill:color-mix(in srgb,var(--brand-2,#2f6bd8) 30%,var(--surface,#fff))}
.pic .f2{fill:color-mix(in srgb,var(--green,#15b364) 34%,var(--surface,#fff))}
.pic .f3{fill:color-mix(in srgb,var(--gold,#f5b81f) 45%,var(--surface,#fff))}
.pic .f4{fill:color-mix(in srgb,var(--red,#e21d27) 30%,var(--surface,#fff))}
.pic .f5{fill:color-mix(in srgb,var(--violet,#6a4fd0) 30%,var(--surface,#fff))}
.pic .f6{fill:color-mix(in srgb,var(--ink,#171534) 12%,var(--surface,#fff))}
.pic .fs{fill:var(--brand-2,#2f6bd8)}
.pic .fr{fill:var(--red,#e21d27)}.pic .fg{fill:var(--green,#15b364)}.pic .fo{fill:var(--gold,#f5b81f)}.pic .fv{fill:var(--violet,#6a4fd0)}
.pic .dot{fill:var(--ink,#171534)}
.pic .t{fill:var(--ink,#171534);font-family:var(--ff-body,system-ui,sans-serif);font-size:12.5px;font-weight:700;text-anchor:middle}
.pic .tl{text-anchor:start}.pic .te{text-anchor:end}.pic .tm{fill:var(--ink-2,#4a4763);font-weight:600}.pic .ts{font-size:10.5px}.pic .tb{font-size:15px}.pic .tx{font-size:9.5px}.pic .tt{font-size:7.5px}
.pic .tr{fill:var(--red,#e21d27)}.pic .tg{fill:var(--green,#0f8a4d)}.pic .ta{fill:var(--brand-2,#2f6bd8)}
`;
