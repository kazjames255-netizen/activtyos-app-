// Translations for the `marketing.` area. Keyed by locale; flat keys. Locales
// without a key fall back to English (see the resolver in provider.tsx).
const marketing: Record<string, Record<string, string>> = {
  en: {
    inHouse: "In-house",
    googleConnectUnavailable: "Google connect isn't available yet.",
  },
  pl: { inHouse: "Wewnętrzne", googleConnectUnavailable: "Połączenie z Google nie jest jeszcze dostępne." },
  ro: { inHouse: "Intern", googleConnectUnavailable: "Conectarea Google nu este încă disponibilă." },
  ur: { inHouse: "اِن ہاؤس", googleConnectUnavailable: "گوگل کنیکٹ ابھی دستیاب نہیں ہے۔" },
  pa: { inHouse: "ਅੰਦਰੂਨੀ", googleConnectUnavailable: "ਗੂਗਲ ਕਨੈਕਟ ਹਾਲੇ ਉਪਲਬਧ ਨਹੀਂ ਹੈ।" },
  bn: { inHouse: "ইন-হাউস", googleConnectUnavailable: "গুগল কানেক্ট এখনও উপলব্ধ নয়।" },
  ar: { inHouse: "داخلي", googleConnectUnavailable: "ربط Google غير متاح بعد." },
  pt: { inHouse: "Interno", googleConnectUnavailable: "A ligação ao Google ainda não está disponível." },
  es: { inHouse: "Internas", googleConnectUnavailable: "La conexión con Google aún no está disponible." },
  fr: { inHouse: "Interne", googleConnectUnavailable: "La connexion Google n'est pas encore disponible." },
  cy: { inHouse: "Mewnol", googleConnectUnavailable: "Nid yw cysylltu â Google ar gael eto." },
};
export default marketing;
