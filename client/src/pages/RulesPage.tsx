import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

function SimpleBoardDiagram() {
  return (
    <svg viewBox="0 0 300 300" className="w-full max-w-[240px] mx-auto my-4">
      {/* Background */}
      <circle cx="150" cy="150" r="145" fill="#1a1a1a" />

      {/* Double ring */}
      <circle cx="150" cy="150" r="130" fill="none" stroke="#e63946" strokeWidth="6" />

      {/* Triple ring */}
      <circle cx="150" cy="150" r="78" fill="none" stroke="#1db954" strokeWidth="6" />

      {/* Outer single zone label */}
      <circle cx="150" cy="150" r="104" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" strokeDasharray="4 4" />

      {/* Inner single zone label */}
      <circle cx="150" cy="150" r="52" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" strokeDasharray="4 4" />

      {/* Bull */}
      <circle cx="150" cy="150" r="24" fill="#1db954" opacity="0.7" />

      {/* Double Bull */}
      <circle cx="150" cy="150" r="10" fill="#e63946" opacity="0.8" />

      {/* Labels */}
      <text x="150" y="12" fill="white" fontSize="11" textAnchor="middle" fontWeight="bold">20</text>

      {/* Zone labels */}
      <text x="230" y="80" fill="rgba(255,255,255,0.5)" fontSize="8" textAnchor="middle">Double (x2)</text>
      <text x="230" y="108" fill="rgba(255,255,255,0.5)" fontSize="8" textAnchor="middle">Single</text>
      <text x="220" y="130" fill="rgba(255,255,255,0.5)" fontSize="8" textAnchor="middle">Triple (x3)</text>
      <text x="210" y="152" fill="rgba(255,255,255,0.5)" fontSize="8" textAnchor="middle">Single</text>
      <text x="150" y="147" fill="white" fontSize="7" textAnchor="middle">Bull 25</text>
      <text x="150" y="155" fill="white" fontSize="6" textAnchor="middle">D-Bull 50</text>

      {/* Arrows */}
      <line x1="220" y1="82" x2="200" y2="95" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" markerEnd="url(#arrowhead)" />
      <line x1="218" y1="110" x2="195" y2="115" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
      <line x1="210" y1="132" x2="192" y2="132" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />

      <defs>
        <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
          <polygon points="0 0, 6 2, 0 4" fill="rgba(255,255,255,0.3)" />
        </marker>
      </defs>
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

            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-muted/50 p-2 rounded">
                  <span className="font-medium text-foreground">Single (x1)</span>
                  <br />
                  <span>Основная зона сектора</span>
                </div>
                <div className="bg-muted/50 p-2 rounded">
                  <span className="font-medium text-foreground">Double (x2)</span>
                  <br />
                  <span>Узкое внешнее кольцо</span>
                </div>
                <div className="bg-muted/50 p-2 rounded">
                  <span className="font-medium text-foreground">Triple (x3)</span>
                  <br />
                  <span>Узкое внутреннее кольцо</span>
                </div>
                <div className="bg-muted/50 p-2 rounded">
                  <span className="font-medium text-foreground">Bull / D-Bull</span>
                  <br />
                  <span>25 / 50 очков (центр)</span>
                </div>
              </div>
              <p className="leading-relaxed">
                Каждый сектор пронумерован от 1 до 20. Очки = номер сектора × множитель.
                Максимум за один дротик — T20 (тройной сектор 20) = 60 очков.
                Double Bull (центр мишени) = 50 очков.
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
