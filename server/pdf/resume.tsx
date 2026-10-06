import path from "node:path";
import { Document, Font, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { GRADE_TITLES, SPECIALIZATION_TITLES, WORK_FORMAT_TITLES, type Grade, type Specialization, type WorkFormat } from "../config";

/**
 * "Beautiful resume" generated from the profile. No LLM: only facts that are
 * stored in the profile, with test-confirmed skills and FSP sources marked.
 */
let fontsReady = false;
function registerFonts() {
  if (fontsReady) return;
  const dir = path.join(process.cwd(), "server", "pdf", "fonts");
  Font.register({
    family: "Golos",
    fonts: [
      { src: path.join(dir, "GolosText-Regular.ttf"), fontWeight: 400 },
      { src: path.join(dir, "GolosText-SemiBold.ttf"), fontWeight: 600 },
    ],
  });
  Font.register({ family: "JetBrains", src: path.join(dir, "JetBrainsMono-Regular.ttf") });
  Font.registerHyphenationCallback((w) => [w]);
  fontsReady = true;
}

const VIOLET = "#402FFF";
const GRAPHITE = "#1B1C21";
const MUTED = "#5B5D66";

const s = StyleSheet.create({
  page: { fontFamily: "Golos", fontSize: 10, color: GRAPHITE, padding: 36, lineHeight: 1.45 },
  frame: { border: `0.8pt solid ${VIOLET}`, borderRadius: 14, padding: 22, flexGrow: 1 },
  kicker: { fontFamily: "JetBrains", fontSize: 7.5, color: VIOLET, letterSpacing: 1.2, textTransform: "uppercase" },
  name: { fontSize: 26, fontWeight: 600, color: VIOLET, marginTop: 6, lineHeight: 1.2 },
  meta: { color: MUTED, marginTop: 4 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 8 },
  badge: { fontFamily: "JetBrains", fontSize: 8, paddingVertical: 2.5, paddingHorizontal: 7, borderRadius: 8, border: `0.6pt solid ${VIOLET}`, color: VIOLET },
  badgeSolid: { fontFamily: "JetBrains", fontSize: 8, paddingVertical: 2.5, paddingHorizontal: 7, borderRadius: 8, backgroundColor: VIOLET, color: "#fff" },
  badgeGray: { fontFamily: "JetBrains", fontSize: 8, paddingVertical: 2.5, paddingHorizontal: 7, borderRadius: 8, border: "0.6pt solid #C8C9CA", color: MUTED },
  section: { marginTop: 16 },
  h: { fontFamily: "JetBrains", fontSize: 8, color: VIOLET, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 6 },
  line: { height: 0.8, backgroundColor: VIOLET, opacity: 0.35, marginTop: 14 },
  item: { flexDirection: "row", gap: 8, marginBottom: 3 },
  year: { fontFamily: "JetBrains", fontSize: 8.5, color: MUTED, width: 34 },
  foot: { fontFamily: "JetBrains", fontSize: 7, color: MUTED, marginTop: 16 },
});

export interface ResumeData {
  fullName: string;
  city: string | null;
  experienceYears: number | null;
  about: string | null;
  workFormat: WorkFormat | null;
  salary: { from: number | null; to: number | null };
  contacts: { email?: string; phone?: string; telegram?: string; links?: string[] };
  categories: { specialization: Specialization; grade: Grade; score: number; assignedAt: Date }[];
  skills: { title: string; source: "declared" | "resume" | "test_confirmed" }[];
  achievements: { competition: string; discipline: string; stage: "regional" | "district" | "final"; year: number; place: number | null; source: string }[];
}

const STAGE = { regional: "региональный этап", district: "окружной этап", final: "финал" } as const;
const SOURCE: Record<string, string> = { fsp_registry: "реестр ФСП", organizer: "организатор", repo: "репозиторий", self: "заявлено" };
const rub = (n: number) => new Intl.NumberFormat("ru-RU").format(n).replace(/ /g, " ");

function ResumeDoc({ d }: { d: ResumeData }) {
  const tested = d.skills.filter((x) => x.source === "test_confirmed");
  const claimed = d.skills.filter((x) => x.source !== "test_confirmed" && !tested.some((t) => t.title === x.title));
  return (
    <Document title={`Резюме — ${d.fullName}`} author="ФСП Таланты" language="ru">
      <Page size="A4" style={s.page}>
        <View style={s.frame}>
          <Text style={s.kicker}>ФСП · Таланты · резюме</Text>
          <Text style={s.name}>{d.fullName}</Text>
          <Text style={s.meta}>
            {[d.city, d.experienceYears !== null ? `опыт ${d.experienceYears} г.` : null, d.workFormat ? WORK_FORMAT_TITLES[d.workFormat] : null, d.salary.from ? `ожидания от ${rub(d.salary.from)} ₽` : null]
              .filter(Boolean)
              .join(" · ")}
          </Text>
          <View style={s.row}>
            {d.categories.map((c) => (
              <Text key={c.specialization} style={s.badgeSolid}>
                {SPECIALIZATION_TITLES[c.specialization]} · {GRADE_TITLES[c.grade]} · тест {c.score.toFixed(1)}/30
              </Text>
            ))}
          </View>
          <Text style={[s.meta, { marginTop: 8 }]}>
            {[d.contacts.email, d.contacts.phone, d.contacts.telegram, ...(d.contacts.links ?? [])].filter(Boolean).join("   ·   ")}
          </Text>
          <View style={s.line} />
          {d.about && (
            <View style={s.section}>
              <Text style={s.h}>О себе</Text>
              <Text>{d.about}</Text>
            </View>
          )}
          {(tested.length > 0 || claimed.length > 0) && (
            <View style={s.section}>
              <Text style={s.h}>Навыки</Text>
              {tested.length > 0 && (
                <View style={s.row}>
                  {tested.map((x) => (
                    <Text key={x.title} style={s.badge}>
                      {x.title} ✓
                    </Text>
                  ))}
                </View>
              )}
              {claimed.length > 0 && (
                <View style={s.row}>
                  {claimed.map((x) => (
                    <Text key={x.title} style={s.badgeGray}>
                      {x.title}
                    </Text>
                  ))}
                </View>
              )}
              <Text style={[s.foot, { marginTop: 6 }]}>✓ — подтверждено тестом платформы; без отметки — заявлено кандидатом</Text>
            </View>
          )}
          {d.achievements.length > 0 && (
            <View style={s.section}>
              <Text style={s.h}>Соревнования ФСП</Text>
              {d.achievements.map((a, i) => (
                <View key={i} style={s.item}>
                  <Text style={s.year}>{a.year}</Text>
                  <Text style={{ flex: 1 }}>
                    {a.competition} — {a.discipline}, {STAGE[a.stage]}
                    {a.place ? `, ${a.place} место` : ", участие"} <Text style={{ color: MUTED }}>({SOURCE[a.source] ?? a.source})</Text>
                  </Text>
                </View>
              ))}
            </View>
          )}
          <View style={{ flexGrow: 1 }} />
          <Text style={s.foot}>
            Сформировано {new Date().toLocaleDateString("ru-RU")} на платформе ФСП Таланты. Категория присвоена по результату адаптивного теста.
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderResumePdf(d: ResumeData): Promise<Buffer> {
  registerFonts();
  return renderToBuffer(<ResumeDoc d={d} />);
}
