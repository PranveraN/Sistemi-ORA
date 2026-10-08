// Shiriti në fund të sistemit, përgjatë gjithë gjerësisë (nën menynë dhe faqen) —
// gjurma e autorësisë së sistemit. Në telefon mbetet vetëm pjesa e mesit.
export default function AppFooter() {
  return (
    <footer className="flex-shrink-0 h-8 px-4 grid grid-cols-1 sm:grid-cols-3 items-center border-t border-primary-200/70 dark:border-primary-900/60 bg-white dark:bg-slate-900 text-[11px] text-slate-500 dark:text-slate-400">
      <span className="hidden sm:block font-medium text-slate-600 dark:text-slate-300">Sistemi Ora v2.0</span>
      <span className="text-center truncate">
        Projektuar dhe ndërtuar nga <span aria-hidden className="text-primary-500">✦</span>{" "}
        <span className="font-semibold text-primary-700 dark:text-primary-300">Pranvera Nevzadi</span>
      </span>
      <span className="hidden sm:block text-right">© 2026 Akademia Ora</span>
    </footer>
  );
}
