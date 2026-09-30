// p8lrn: overnight i18n sweep (1 Oct 2026). Row order: en, pl, ro, ur, pa, bn, ar, pt, es, fr, cy. Use {brand} for the product name.
import { fromRows } from "./_rows";

export default fromRows({
  // ---- generic (shared by the learning / documents / compliance / reviews / ai views)
  gCancel: ["Cancel", "Anuluj", "Anulează", "منسوخ کریں", "ਰੱਦ ਕਰੋ", "বাতিল", "إلغاء", "Cancelar", "Cancelar", "Annuler", "Diddymu"],
  gSave: ["Save", "Zapisz", "Salvează", "محفوظ کریں", "ਸੇਵ ਕਰੋ", "সংরক্ষণ", "حفظ", "Guardar", "Guardar", "Enregistrer", "Cadw"],
  gEdit: ["Edit", "Edytuj", "Editează", "ترمیم", "ਸੋਧੋ", "সম্পাদনা", "تعديل", "Editar", "Editar", "Modifier", "Golygu"],
  gDelete: ["Delete", "Usuń", "Șterge", "حذف کریں", "ਮਿਟਾਓ", "মুছুন", "حذف", "Eliminar", "Eliminar", "Supprimer", "Dileu"],
  gClose: ["Close", "Zamknij", "Închide", "بند کریں", "ਬੰਦ ਕਰੋ", "বন্ধ", "إغلاق", "Fechar", "Cerrar", "Fermer", "Cau"],
  gLoading: ["Loading…", "Ładowanie…", "Se încarcă…", "لوڈ ہو رہا ہے…", "ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ…", "লোড হচ্ছে…", "جارٍ التحميل…", "A carregar…", "Cargando…", "Chargement…", "Yn llwytho…"],
  gSearch: ["Search…", "Szukaj…", "Caută…", "تلاش کریں…", "ਖੋਜੋ…", "খুঁজুন…", "بحث…", "Pesquisar…", "Buscar…", "Rechercher…", "Chwilio…"],
  gBack: ["Back", "Wstecz", "Înapoi", "واپس", "ਪਿੱਛੇ", "পিছনে", "رجوع", "Voltar", "Atrás", "Retour", "Yn ôl"],
  gNext: ["Next", "Dalej", "Următorul", "اگلا", "ਅੱਗੇ", "পরবর্তী", "التالي", "Seguinte", "Siguiente", "Suivant", "Nesaf"],
  gDone: ["Done", "Gotowe", "Gata", "مکمل", "ਹੋ ਗਿਆ", "সম্পন্ন", "تم", "Concluído", "Hecho", "Terminé", "Wedi gorffen"],
  gYes: ["Yes", "Tak", "Da", "ہاں", "ਹਾਂ", "হ্যাঁ", "نعم", "Sim", "Sí", "Oui", "Ie"],
  gNo: ["No", "Nie", "Nu", "نہیں", "ਨਹੀਂ", "না", "لا", "Não", "No", "Non", "Na"],
  gRetry: ["Try again", "Spróbuj ponownie", "Încearcă din nou", "دوبارہ کوشش کریں", "ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ", "আবার চেষ্টা করুন", "حاول مرة أخرى", "Tentar novamente", "Intentar de nuevo", "Réessayer", "Rhowch gynnig arall arni"],
  gSend: ["Send", "Wyślij", "Trimite", "بھیجیں", "ਭੇਜੋ", "পাঠান", "إرسال", "Enviar", "Enviar", "Envoyer", "Anfon"],
  gAdd: ["Add", "Dodaj", "Adaugă", "شامل کریں", "ਸ਼ਾਮਲ ਕਰੋ", "যোগ করুন", "إضافة", "Adicionar", "Añadir", "Ajouter", "Ychwanegu"],
  gOther: ["Other", "Inne", "Altele", "دیگر", "ਹੋਰ", "অন্যান্য", "أخرى", "Outro", "Otro", "Autre", "Arall"],
  gSomethingWrong: ["Something went wrong", "Coś poszło nie tak", "Ceva nu a mers bine", "کچھ غلط ہو گیا", "ਕੁਝ ਗਲਤ ਹੋ ਗਿਆ", "কিছু ভুল হয়েছে", "حدث خطأ ما", "Algo correu mal", "Algo salió mal", "Une erreur s’est produite", "Aeth rhywbeth o'i le"],
  //@@END
});
