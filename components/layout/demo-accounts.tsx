import { demoLoginAction } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/demo-accounts";

/** Demo accounts with one-click sign-in; render only in DEMO_MODE. */
export function DemoAccounts({ className }: { className?: string }) {
  return (
    <section className={className} aria-labelledby="demo-accounts">
      <h2 id="demo-accounts" className="label-mono mb-2">
        Демо-аккаунты
      </h2>
      <p className="mb-3 text-sm text-pretty text-muted">
        Регистрироваться не обязательно: войдите в готовый аккаунт с данными и посмотрите, как всё работает. Пароль у всех —{" "}
        <span className="font-mono text-fg">{DEMO_PASSWORD}</span>.
      </p>
      <ul className="list-frame">
        {DEMO_ACCOUNTS.map((a) => (
          <li key={a.email} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                <span className="font-medium">{a.role}</span> <span className="font-mono text-xs break-all text-muted">{a.email}</span>
              </p>
              <p className="text-xs text-pretty text-muted">{a.about}</p>
            </div>
            <form action={demoLoginAction}>
              <input type="hidden" name="email" value={a.email} />
              <Button type="submit" variant="secondary" size="sm" aria-label={`Войти как ${a.email}`}>
                Войти
              </Button>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}
