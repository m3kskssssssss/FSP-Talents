import { signOut } from "@/server/auth";
import { buttonClass } from "../ui/button";

export function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/" });
      }}
    >
      <button type="submit" className={buttonClass("secondary", "sm")}>
        Выйти
      </button>
    </form>
  );
}
