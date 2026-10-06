import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-accent/15">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          <span className="label-mono mr-2">ФСП · Таланты</span>
          Прототип для кейса Федерации спортивного программирования
        </p>
        <nav aria-label="Документы" className="flex flex-wrap gap-4">
          <Link className="link" href="/privacy">
            Политика обработки ПДн
          </Link>
          <Link className="link" href="/api/docs">
            API
          </Link>
        </nav>
      </div>
    </footer>
  );
}
