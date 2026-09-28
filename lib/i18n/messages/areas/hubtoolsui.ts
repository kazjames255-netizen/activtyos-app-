// Translations for the `hubtoolsui.` area: the floating tool window's own words (the "Just the tool" pill, See-through / Solid, resize read-out, dock collapse).
// Same flat keys in every locale; {placeholders} are shared. Wording is kept identical to hublive.dSeeThrough / dSolid / dMoveWord so both modes read the same.
const hubtoolsui: Record<string, Record<string, string>> = {
  en: { move: "Move", seeThrough: "See-through", solid: "Solid", backToWindow: "Back to window", collapseTools: "Collapse tools", resizeValue: "{w} by {h} pixels", moveHint: "Drag this pill to move the tool" },
  pl: { move: "Przesuń", seeThrough: "Przezroczysty", solid: "Pełny", backToWindow: "Wróć do okna", collapseTools: "Zwiń narzędzia", resizeValue: "{w} na {h} pikseli", moveHint: "Przeciągnij tę pigułkę, aby przesunąć narzędzie" },
  ro: { move: "Mută", seeThrough: "Transparent", solid: "Opac", backToWindow: "Înapoi la fereastră", collapseTools: "Restrânge instrumentele", resizeValue: "{w} pe {h} pixeli", moveHint: "Trage această pastilă ca să muți instrumentul" },
  ur: { move: "ہلائیں", seeThrough: "شفاف", solid: "ٹھوس", backToWindow: "کھڑکی پر واپس", collapseTools: "اوزار سمیٹیں", resizeValue: "{w} ضرب {h} پکسل", moveHint: "اوزار کو ہلانے کے لیے اس گولی کو گھسیٹیں" },
  pa: { move: "ਹਿਲਾਓ", seeThrough: "ਪਾਰਦਰਸ਼ੀ", solid: "ਠੋਸ", backToWindow: "ਵਿੰਡੋ ਵਿੱਚ ਵਾਪਸ", collapseTools: "ਟੂਲ ਸਮੇਟੋ", resizeValue: "{w} ਗੁਣਾ {h} ਪਿਕਸਲ", moveHint: "ਟੂਲ ਨੂੰ ਹਿਲਾਉਣ ਲਈ ਇਸ ਗੋਲੀ ਨੂੰ ਖਿੱਚੋ" },
  bn: { move: "সরান", seeThrough: "স্বচ্ছ", solid: "অস্বচ্ছ", backToWindow: "উইন্ডোতে ফিরুন", collapseTools: "টুল গুটিয়ে নিন", resizeValue: "{w} বাই {h} পিক্সেল", moveHint: "টুলটি সরাতে এই পিলটি টানুন" },
  ar: { move: "تحريك", seeThrough: "شفّاف", solid: "معتم", backToWindow: "العودة إلى النافذة", collapseTools: "طيّ الأدوات", resizeValue: "{w} في {h} بكسل", moveHint: "اسحب هذه الحبة لتحريك الأداة" },
  pt: { move: "Mover", seeThrough: "Transparente", solid: "Opaco", backToWindow: "Voltar à janela", collapseTools: "Recolher ferramentas", resizeValue: "{w} por {h} pixels", moveHint: "Arraste esta pílula para mover a ferramenta" },
  es: { move: "Mover", seeThrough: "Transparente", solid: "Opaco", backToWindow: "Volver a la ventana", collapseTools: "Contraer herramientas", resizeValue: "{w} por {h} píxeles", moveHint: "Arrastra esta píldora para mover la herramienta" },
  fr: { move: "Déplacer", seeThrough: "Transparent", solid: "Opaque", backToWindow: "Retour à la fenêtre", collapseTools: "Réduire les outils", resizeValue: "{w} sur {h} pixels", moveHint: "Faites glisser cette pastille pour déplacer l’outil" },
  cy: { move: "Symud", seeThrough: "Tryloyw", solid: "Solet", backToWindow: "Yn ôl i'r ffenestr", collapseTools: "Cau'r offer", resizeValue: "{w} wrth {h} picsel", moveHint: "Llusgwch y pilsen hon i symud yr offeryn" },
};
export default hubtoolsui;
