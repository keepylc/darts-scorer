import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

function SimpleBoardDiagram() {
  const cx = 130, cy = 130;

  return (
    <svg
      viewBox="0 0 260 260"
      className="w-full max-w-[180px] mx-auto my-2"
      aria-label="Схема мишени дартс"
    >
      <circle cx={cx} cy={cy} r={126} fill="#e63946" />
      <circle cx={cx} cy={cy} r={101} fill="#2a2a2a" />
      <circle cx={cx} cy={cy} r={76}  fill="#1db954" />
      <circle cx={cx} cy={cy} r={51}  fill="#2a2a2a" />
      <circle cx={cx} cy={cy} r={23}  fill="#1db954" />
      <circle cx={cx} cy={cy} r={10}  fill="#e63946" />
      <circle cx={cx} cy={cy} r={126} fill="none"
              stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
      <text x={cx} y={cy - 108} fill="white" fontSize="13" fontWeight="bold"
            textAnchor="middle" dominantBaseline="central">
        20
      </text>
    </svg>
  );
}

export default function RulesPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-2xl mx-auto"
    >
      <Link href="/">
        <Button variant="ghost" size="sm" className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Назад
        </Button>
      </Link>

      <h1 className="text-xl font-bold mb-4">Правила игры в дартс (X01)</h1>

      <div className="space-y-4">
        {/* Что такое дартс */}
        <Card>
          <CardContent className="p-4 space-y-2">
            <h2 className="font-semibold">Что такое дартс?</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Дартс — спортивная игра, в которой игроки по очереди бросают дротики в мишень.
              Цель — набрать определённое количество очков, уменьшая свой счёт от стартового
              значения до нуля.
            </p>
          </CardContent>
        </Card>

        {/* Правила X01 */}
        <Card>
          <CardContent className="p-4 space-y-2">
            <h2 className="font-semibold">Правила X01 (301 / 501 / 701)</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Каждый игрок начинает с заданного количества очков (301, 501 или 701).
              За каждый ход (3 дротика) набранные очки вычитаются из текущего счёта.
              Побеждает тот, кто первым снизит свой счёт ровно до 0.
            </p>
          </CardContent>
        </Card>

        {/* Система подсчёта */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <h2 className="font-semibold">Система подсчёта очков</h2>

            <SimpleBoardDiagram />

            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Зоны мишени</h3>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { color: "bg-[#2a2a2a] border border-border", dot: "", label: "Single (×1)", sub: "Основная зона сектора — очки равны номеру" },
                  { color: "", dot: "bg-[#e63946]", label: "Double (×2)", sub: "Внешнее узкое кольцо — очки удваиваются" },
                  { color: "", dot: "bg-[#1db954]", label: "Triple (×3)", sub: "Внутреннее узкое кольцо — очки утраиваются" },
                  { color: "", dot: "bg-[#1db954]", label: "Bull — 25 очков", sub: "Зелёный центр мишени" },
                  { color: "", dot: "bg-[#e63946]", label: "Double Bull — 50 очков", sub: "Красная точка в центре, засчитывается как Double" },
                ].map(({ dot, label, sub }) => (
                  <div key={label} className="flex items-start gap-3 bg-muted/50 px-3 py-2.5 rounded">
                    <span className={`mt-1 shrink-0 w-3 h-3 rounded-sm ${dot || "bg-muted-foreground/30 border border-border"}`} />
                    <div>
                      <p className="text-sm font-medium text-foreground">{label}</p>
                      <p className="text-sm text-muted-foreground">{sub}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Максимум за один дротик — T20 = 60 очков. Максимальный финиш за 3 дротика — 170 (T20 T20 D-Bull).
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Double Out */}
        <Card>
          <CardContent className="p-4 space-y-2">
            <h2 className="font-semibold">Правило Double Out</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Для завершения игры последний бросок должен попасть в зону{" "}
              <span className="text-foreground font-medium">Double</span> (внешнее узкое кольцо)
              или{" "}
              <span className="text-foreground font-medium">Double Bull</span> (центр мишени, 50 очков).
              Счёт после последнего броска должен быть ровно 0.
            </p>
          </CardContent>
        </Card>

        {/* Bust */}
        <Card>
          <CardContent className="p-4 space-y-2">
            <h2 className="font-semibold">Что такое Bust (перебор)?</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Bust (перебор) происходит, когда:
            </p>
            <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
              <li>Счёт уходит ниже 0</li>
              <li>Счёт становится равен 1 (невозможно закрыть double)</li>
              <li>Счёт становится 0, но последний бросок не был Double</li>
            </ul>
            <p className="text-sm text-muted-foreground leading-relaxed">
              При bust ход полностью аннулируется — счёт возвращается к значению до хода.
            </p>
          </CardContent>
        </Card>

        <Separator />

        {/* Примеры финишей */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <h2 className="font-semibold">Примеры финишных комбинаций</h2>
            <div className="space-y-1.5 text-sm">
              {[
                { score: 170, path: "T20 → T20 → D-Bull", note: "максимальный финиш" },
                { score: 160, path: "T20 → T20 → D20", note: "" },
                { score: 100, path: "T20 → D20", note: "за 2 дротика" },
                { score: 50, path: "D-Bull", note: "за 1 дротик" },
                { score: 40, path: "D20", note: "за 1 дротик" },
                { score: 32, path: "D16", note: "за 1 дротик" },
                { score: 16, path: "D8", note: "за 1 дротик" },
                { score: 2, path: "D1", note: "минимальный финиш" },
              ].map((ex) => (
                <div
                  key={ex.score}
                  className="flex items-center gap-3 bg-muted/50 px-3 py-1.5 rounded"
                >
                  <span className="font-bold tabular-nums w-10 text-right text-foreground">
                    {ex.score}
                  </span>
                  <span className="font-mono text-primary">{ex.path}</span>
                  {ex.note && (
                    <span className="text-muted-foreground text-xs ml-auto">
                      {ex.note}
                    </span>
                  )}
                </div>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">
              Финиш возможен при счёте от 2 до 170 очков. Выше 170 — невозможно закрыть за 3 дротика.
            </p>
          </CardContent>
        </Card>

        {/* Tips */}
        <Card>
          <CardContent className="p-4 space-y-2">
            <h2 className="font-semibold">Советы</h2>
            <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
              <li>В режиме 501 наиболее популярной стратегией является стрельба по T20 (60 очков) для быстрого снижения счёта</li>
              <li>При оставшихся 40 очках стремитесь в D20 — это самый популярный финиш</li>
              <li>Приложение автоматически подсказывает оптимальный финиш</li>
              <li>Если промахнулись мимо доски, нажмите кнопку «Мимо»</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="text-center mt-6 mb-4">
        <Link href="/">
          <Button variant="default" className="min-h-[44px]">
            Начать игру
          </Button>
        </Link>
      </div>
    </motion.div>
  );
}
