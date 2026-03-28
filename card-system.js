(function () {
  "use strict";

  const BUFF_HAND_LIMIT = 30;
  const ABILITY_HAND_LIMIT = 10;
  const SIM_TIME_PER_REAL_SECOND = 2.5;
  const BUFF_DURATION_MULT = 3;

  const RARITY_WEIGHTS = {
    common: 45,
    uncommon: 28,
    rare: 15,
    epic: 8,
    legendary: 3,
    mythic: 1
  };

  const BUFF_DURATION_BY_RARITY = {
    common: 45,
    uncommon: 60,
    rare: 75,
    epic: 95,
    legendary: null,
    mythic: null
  };

  const DRAW_TYPE_WEIGHTS = {
    buff: 0.78,
    ability: 0.22
  };

  function formatNumber(value) {
    const rounded = Math.round(Number(value || 0) * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace(/\.0$/, "");
  }

  function formatSignedNumber(value) {
    const numeric = Number(value || 0);
    return (numeric >= 0 ? "+" : "") + formatNumber(numeric);
  }

  function formatPercentFromMultiplier(multiplier) {
    const numeric = Number(multiplier || 1);
    return formatSignedNumber((numeric - 1) * 100) + "%";
  }

  function formatRealDuration(simSeconds) {
    if (simSeconds == null) return "";
    return formatNumber(simSeconds / SIM_TIME_PER_REAL_SECOND) + "с";
  }

  const BUFF_DESC_OVERRIDES = {
    L11: "Постоянно: +0.5 регена щита/с и +100 Энергии ядра. Макс. 3 стака.",
    P1: "Постоянно: +1 патрульный по орбите ядра. Макс. 4 стака.",
    M1: "Постоянно: лазеры получают цепную молнию. 1/2/3 стака дают 3/6/9 скачков. Макс. 3 стака.",
    M2: "Постоянно: попадания замедляют цель. 1/2/3 стака дают 40% на 2/3/4с. Макс. 3 стака.",
    M3: "Постоянно: попадания поджигают цель. 1/2/3 стака дают 3/5/8 урона в секунду на 3/4/5с. Макс. 3 стака."
  };

  function buildBuffCardDescription(card) {
    if (!card) return "";
    if (BUFF_DESC_OVERRIDES[card.id]) return BUFF_DESC_OVERRIDES[card.id];
    const effects = [];
    if (card.unitHpMul != null && card.unitHpMul !== 1) effects.push(formatPercentFromMultiplier(card.unitHpMul) + " к HP кораблей");
    if (card.unitDmgMul != null && card.unitDmgMul !== 1) effects.push(formatPercentFromMultiplier(card.unitDmgMul) + " к урону кораблей");
    if (card.unitAtkRateMul != null && card.unitAtkRateMul !== 1) effects.push(formatPercentFromMultiplier(card.unitAtkRateMul) + " к скорострельности кораблей");
    if (card.unitSpeedMul != null && card.unitSpeedMul !== 1) effects.push(formatPercentFromMultiplier(card.unitSpeedMul) + " к скорости кораблей");
    if (card.growthMul != null && card.growthMul !== 1) effects.push(formatPercentFromMultiplier(card.growthMul) + " к приросту Энергии");
    if (card.unitAtkRangeMul != null && card.unitAtkRangeMul !== 1) effects.push(formatPercentFromMultiplier(card.unitAtkRangeMul) + " к дальности кораблей");
    if (card.turretHpMul != null && card.turretHpMul !== 1) effects.push(formatPercentFromMultiplier(card.turretHpMul) + " к HP турелей");
    if (card.turretDmgMul != null && card.turretDmgMul !== 1) effects.push(formatPercentFromMultiplier(card.turretDmgMul) + " к урону турелей");
    if (card.turretRangeMul != null && card.turretRangeMul !== 1) effects.push(formatPercentFromMultiplier(card.turretRangeMul) + " к радиусу турелей");
    if (card.influenceSpeedMul != null && card.influenceSpeedMul !== 1) effects.push(formatPercentFromMultiplier(card.influenceSpeedMul) + " к скорости зоны влияния");
    if (card.mineYieldBonus) effects.push(formatSignedNumber(card.mineYieldBonus) + "% к добыче шахт");
    if (card.unitCostMul != null && card.unitCostMul !== 1) effects.push(formatPercentFromMultiplier(card.unitCostMul) + " к стоимости кораблей");
    if (card.shieldRegenBonus) effects.push(formatSignedNumber(card.shieldRegenBonus) + " регена щита/с");
    if (card.populationBonus) effects.push(formatSignedNumber(card.populationBonus) + " Энергии ядра");
    if (card.patrolBonus) effects.push(formatSignedNumber(card.patrolBonus) + " патрульный по орбите ядра");
    if (card.turretTargetBonus) effects.push(formatSignedNumber(card.turretTargetBonus) + " цель патрулям за залп");
    const timing = card.permanent ? "Постоянно" : ("На " + formatRealDuration(card.durationSec));
    let desc = effects.length ? (timing + ": " + effects.join(", ") + ".") : (timing + ".");
    if (card.maxStacks != null) desc += " Макс. " + card.maxStacks + " стака.";
    return desc;
  }

  const ABILITY_DESC_BY_ID = {
    ionField: "На 3с создаёт ионный шторм радиусом 210: каждые 0.5с снимает 10% текущего HP и в конце наносит ещё 2% max HP.",
    ionNebula: "На 10с создаёт ионный шторм радиусом 210: каждые 0.5с снимает 10% текущего HP и в конце наносит ещё 2% max HP.",
    activeShield: "Даёт всем текущим кораблям временный щит на 25% от их max HP.",
    fleetBoost: "На 20с даёт всем своим кораблям +50% скорости.",
    resourceSurge: "Мгновенно даёт +2200 eCredits.",
    raiderCapture: "Крадёт у выбранного ядра 12% Энергии, но не больше 70, и переводит её вам.",
    minefield: "Разворачивает 5 мин на 15с: радиус срабатывания 34, взрыв 85, урон 110 + 12% max HP.",
    minefieldLarge: "Разворачивает 25 мин на 22с: радиус срабатывания 44, взрыв 110, урон 180 + 18% max HP.",
    meteor: "Запускает 1 метеор по линии: взрыв радиусом 120 наносит 50% max HP + 100.",
    meteorSwarm: "Запускает 6 метеоров веером по линии: каждый взрыв радиусом 120 наносит 50% max HP + 100.",
    microBlackHole: "На 5с создаёт микро-чёрную дыру радиусом 133: притягивает врагов и наносит 0.3-3.3% max HP/с.",
    microAnchor: "На 7с создаёт зону радиусом 220: стягивает врагов к центру и держит их в коротком стазисе.",
    blackHole: "На 17с создаёт чёрную дыру радиусом 400: притягивает врагов и наносит 1-10% max HP/с.",
    gravAnchor: "На 20с создаёт зону радиусом 420: стягивает врагов к центру и держит их в коротком стазисе.",
    orbitalStrike: "2 залпа по 5 ударов по зоне радиусом 250. Каждый удар бьёт в радиусе 130 и наносит 340 + 15% max HP.",
    orbitalBarrage: "6 залпов по 5 ударов по зоне радиусом 320. Каждый удар бьёт в радиусе 110 и наносит 260 + 10% max HP.",
    thermoNuke: "Через 3.2с наносит удар по зоне радиусом 500: уничтожает все корабли внутри и обнуляет щит ядра."
  };

  function buildAbilityDescription(ability) {
    return ABILITY_DESC_BY_ID[ability && ability.id] || (ability && ability.desc) || "";
  }

  const ABILITY_DEFS = [
    { id: "ionField", name: "Ионное поле", desc: "Короткий ионный шторм на 3с в одной зоне", cooldown: 70, icon: "⚡", targeting: "point", cardRarity: "epic" },
    { id: "ionNebula", name: "Ионный шторм", desc: "Легендарный ионный шторм с прежним визуалом", cooldown: 120, icon: "🌩️", targeting: "point", cardRarity: "legendary" },
    { id: "activeShield", name: "Фронтовой щит", desc: "+25% временного щита всем своим кораблям", cooldown: 75, icon: "🛡️", cardRarity: "rare" },
    { id: "fleetBoost", name: "Форсаж эскадры", desc: "+50% скорости всем своим юнитам на 20с", cooldown: 70, icon: "⚡", cardRarity: "rare" },
    { id: "resourceSurge", name: "Ресурсный всплеск", desc: "+2200 eCredits мгновенно", cooldown: 150, icon: "💎", cardRarity: "rare" },
    { id: "raiderCapture", name: "Похищение энергии", desc: "Крадёт 12% энергии выбранного ядра, но не больше 70", cooldown: 110, icon: "🔌", targeting: "city", cardRarity: "rare" },
    { id: "minefield", name: "Малое минное поле", desc: "5 мин ложатся вглубь своего коридора и взрываются по площади", cooldown: 90, icon: "🧨", targeting: "point", cardRarity: "epic" },
    { id: "minefieldLarge", name: "Большое минное поле", desc: "25 мин плотным полем уходят вглубь коридора и перекрывают проход", cooldown: 135, icon: "🧨", targeting: "point", cardRarity: "legendary" },
    { id: "meteor", name: "Линейный метеор", desc: "Один быстрый метеор по линии. Младшая версия дождя.", cooldown: 95, icon: "☄️", targeting: "angle", cardRarity: "epic" },
    { id: "meteorSwarm", name: "Метеоритный дождь", desc: "Легендарный залп метеоров по линии", cooldown: 140, icon: "☄️", targeting: "angle", cardRarity: "legendary" },
    { id: "microBlackHole", name: "Микро-чёрная дыра", desc: "Упрощённая дыра: 5с, радиус и урон в 3 раза меньше", cooldown: 95, icon: "🕳️", targeting: "point", cardRarity: "epic" },
    { id: "microAnchor", name: "Микро-якорь", desc: "Короткая стяжка-стазис в небольшой зоне", cooldown: 80, icon: "🧲", targeting: "point", cardRarity: "epic" },
    { id: "blackHole", name: "Чёрная дыра", desc: "Легендарная зона притяжения и урона", cooldown: 180, icon: "🕳️", targeting: "point", cardRarity: "legendary" },
    { id: "gravAnchor", name: "Грав. якорь", desc: "Легендарная зона стяжки и фиксации врагов", cooldown: 110, icon: "⚓", targeting: "point", cardRarity: "legendary" },
    { id: "orbitalStrike", name: "Орбитальный удар", desc: "2 залпа по 5 выстрелов в случайные точки выбранной зоны", cooldown: 95, icon: "💥", targeting: "point", cardRarity: "epic" },
    { id: "orbitalBarrage", name: "Орбитальная канонада", desc: "10 залпов по 5 выстрелов накрывают зону случайными попаданиями", cooldown: 145, icon: "💥", targeting: "point", cardRarity: "legendary" },
    { id: "thermoNuke", name: "Термоядерный импульс", desc: "Сверхтяжёлый удар по огромной зоне", cooldown: 200, icon: "☢️", targeting: "point", cardRarity: "legendary" }
  ].map((ability) => Object.assign({}, ability, { desc: buildAbilityDescription(ability) }));

  function makeBuffCard(base) {
    const rarity = base.rarity || "common";
    const baseDuration = BUFF_DURATION_BY_RARITY[rarity];
    const card = Object.assign({
      zone: "buff",
      kind: "buff",
      durationSec: baseDuration == null ? baseDuration : baseDuration * BUFF_DURATION_MULT * SIM_TIME_PER_REAL_SECOND,
      permanent: rarity === "legendary" || rarity === "mythic"
    }, base);
    card.desc = buildBuffCardDescription(card);
    return card;
  }

  const BUFF_CARD_DEFS = [
    makeBuffCard({ id: "c1", name: "Плазменная броня", desc: "+8% HP кораблей", rarity: "common", icon: "🛡️", unitHpMul: 1.08 }),
    makeBuffCard({ id: "c2", name: "Усиленные лазеры", desc: "+8% урон кораблей", rarity: "common", icon: "🔫", unitDmgMul: 1.08 }),
    makeBuffCard({ id: "c3", name: "Частотный модулятор", desc: "+7% скорострельность", rarity: "common", icon: "⚡", unitAtkRateMul: 1.07 }),
    makeBuffCard({ id: "c4", name: "Форсаж двигателей", desc: "+7% скорость кораблей", rarity: "common", icon: "🚀", unitSpeedMul: 1.07 }),
    makeBuffCard({ id: "c5", name: "Перезарядка ядра", desc: "+7% прирост Энергии", rarity: "common", icon: "⚡", growthMul: 1.07 }),
    makeBuffCard({ id: "c6", name: "Сканер дальности", desc: "+8% дальность атаки", rarity: "common", icon: "📡", unitAtkRangeMul: 1.08 }),
    makeBuffCard({ id: "c7", name: "Усиление турелей", desc: "+10% HP турелей", rarity: "common", icon: "🏗️", turretHpMul: 1.10 }),
    makeBuffCard({ id: "c8", name: "Точные орудия", desc: "+10% урон турелей", rarity: "common", icon: "🎯", turretDmgMul: 1.10 }),
    makeBuffCard({ id: "c9", name: "Экспансия", desc: "+5% скорость зоны влияния", rarity: "common", icon: "🌐", influenceSpeedMul: 1.05 }),
    makeBuffCard({ id: "c10", name: "Оптимизация добычи", desc: "+10% к добыче шахт", rarity: "common", icon: "⛏️", mineYieldBonus: 10 }),
    makeBuffCard({ id: "c11", name: "Экономия ресурсов", desc: "-5% стоимость кораблей", rarity: "common", icon: "💰", unitCostMul: 0.95 }),

    makeBuffCard({ id: "u1", name: "Титановый корпус", desc: "+12% HP кораблей", rarity: "uncommon", icon: "🛡️", unitHpMul: 1.12 }),
    makeBuffCard({ id: "u2", name: "Фокусированные лазеры", desc: "+12% урон кораблей", rarity: "uncommon", icon: "🔫", unitDmgMul: 1.12 }),
    makeBuffCard({ id: "u3", name: "Разгон орудий", desc: "+10% скорострельность", rarity: "uncommon", icon: "⚡", unitAtkRateMul: 1.10 }),
    makeBuffCard({ id: "u4", name: "Ионные двигатели", desc: "+10% скорость кораблей", rarity: "uncommon", icon: "🚀", unitSpeedMul: 1.10 }),
    makeBuffCard({ id: "u5", name: "Энергоразгон", desc: "+12% прирост Энергии", rarity: "uncommon", icon: "⚡", growthMul: 1.12 }),
    makeBuffCard({ id: "u6", name: "Дальний радар", desc: "+12% дальность атаки", rarity: "uncommon", icon: "📡", unitAtkRangeMul: 1.12 }),
    makeBuffCard({ id: "u7", name: "Укреплённые турели", desc: "+18% HP турелей", rarity: "uncommon", icon: "🏗️", turretHpMul: 1.18 }),
    makeBuffCard({ id: "u8", name: "Тяжёлые орудия", desc: "+15% урон турелей", rarity: "uncommon", icon: "🎯", turretDmgMul: 1.15 }),
    makeBuffCard({ id: "u9", name: "Терраформирование", desc: "+10% скорость зоны", rarity: "uncommon", icon: "🌐", influenceSpeedMul: 1.10 }),
    makeBuffCard({ id: "u10", name: "Улучшенная добыча", desc: "+20% к добыче шахт", rarity: "uncommon", icon: "⛏️", mineYieldBonus: 20 }),
    makeBuffCard({ id: "u11", name: "Оптовые закупки", desc: "-8% стоимость кораблей", rarity: "uncommon", icon: "💰", unitCostMul: 0.92 }),

    makeBuffCard({ id: "r1", name: "Нанокомпозит", desc: "+18% HP кораблей", rarity: "rare", icon: "🛡️", unitHpMul: 1.18 }),
    makeBuffCard({ id: "r2", name: "Плазменные пушки", desc: "+18% урон кораблей", rarity: "rare", icon: "🔫", unitDmgMul: 1.18 }),
    makeBuffCard({ id: "r3", name: "Ускоритель частиц", desc: "+15% скорострельность", rarity: "rare", icon: "⚡", unitAtkRateMul: 1.15 }),
    makeBuffCard({ id: "r4", name: "Варп-двигатель", desc: "+15% скорость кораблей", rarity: "rare", icon: "🚀", unitSpeedMul: 1.15 }),
    makeBuffCard({ id: "r5", name: "Энергоядро", desc: "+18% прирост Энергии", rarity: "rare", icon: "⚡", growthMul: 1.18 }),
    makeBuffCard({ id: "r6", name: "Телескоп", desc: "+18% дальность атаки", rarity: "rare", icon: "📡", unitAtkRangeMul: 1.18 }),
    makeBuffCard({ id: "r7", name: "Бастион", desc: "+20% HP, +10% радиус турелей", rarity: "rare", icon: "🏗️", turretHpMul: 1.20, turretRangeMul: 1.10 }),
    makeBuffCard({ id: "r8", name: "Артиллерийские турели", desc: "+20% урон турелей", rarity: "rare", icon: "🎯", turretDmgMul: 1.20 }),
    makeBuffCard({ id: "r9", name: "Империя", desc: "+18% скорость зоны", rarity: "rare", icon: "🌐", influenceSpeedMul: 1.18 }),
    makeBuffCard({ id: "r10", name: "Глубокое бурение", desc: "+30% к добыче шахт", rarity: "rare", icon: "⛏️", mineYieldBonus: 30 }),
    makeBuffCard({ id: "r11", name: "Военный контракт", desc: "-12% стоимость кораблей", rarity: "rare", icon: "💰", unitCostMul: 0.88 }),
    makeBuffCard({ id: "r12", name: "Дальнобойные турели", desc: "+15% радиус турелей", rarity: "rare", icon: "📡", turretRangeMul: 1.15 }),

    makeBuffCard({ id: "e1", name: "Квантовая броня", desc: "+25% HP кораблей", rarity: "epic", icon: "🛡️", unitHpMul: 1.25 }),
    makeBuffCard({ id: "e2", name: "Дезинтеграторы", desc: "+25% урон кораблей", rarity: "epic", icon: "🔫", unitDmgMul: 1.25 }),
    makeBuffCard({ id: "e3", name: "Гиперзалп", desc: "+22% скорострельность", rarity: "epic", icon: "⚡", unitAtkRateMul: 1.22 }),
    makeBuffCard({ id: "e4", name: "Гипердрайв", desc: "+22% скорость кораблей", rarity: "epic", icon: "🚀", unitSpeedMul: 1.22 }),
    makeBuffCard({ id: "e5", name: "Перегрузка ядра", desc: "+25% прирост Энергии", rarity: "epic", icon: "⚡", growthMul: 1.25 }),
    makeBuffCard({ id: "e6", name: "Система наведения", desc: "+25% дальность атаки", rarity: "epic", icon: "📡", unitAtkRangeMul: 1.25 }),
    makeBuffCard({ id: "e7", name: "Суперфорт", desc: "+30% урон и HP турелей", rarity: "epic", icon: "🏗️", turretDmgMul: 1.30, turretHpMul: 1.20 }),
    makeBuffCard({ id: "e8", name: "Доминирование", desc: "+30% скорость зоны", rarity: "epic", icon: "🌐", influenceSpeedMul: 1.30 }),
    makeBuffCard({ id: "e9", name: "Мульти-прицел", desc: "Каждый патрульный стреляет по +1 цели", rarity: "epic", icon: "🎯", turretTargetBonus: 1 }),
    makeBuffCard({ id: "e10", name: "Промышленная революция", desc: "-18% стоимость кораблей", rarity: "epic", icon: "💰", unitCostMul: 0.82 }),

    makeBuffCard({ id: "L1", name: "Нейтронный корпус", desc: "+40% HP кораблей", rarity: "legendary", icon: "🛡️", unitHpMul: 1.40 }),
    makeBuffCard({ id: "L2", name: "Аннигиляторы", desc: "+40% урон кораблей", rarity: "legendary", icon: "🔫", unitDmgMul: 1.40 }),
    makeBuffCard({ id: "L3", name: "Тахионный залп", desc: "+35% скорострельность", rarity: "legendary", icon: "⚡", unitAtkRateMul: 1.35 }),
    makeBuffCard({ id: "L4", name: "Скорость света", desc: "+35% скорость кораблей", rarity: "legendary", icon: "🚀", unitSpeedMul: 1.35 }),
    makeBuffCard({ id: "L5", name: "Сверхзаряд ядра", desc: "+40% прирост Энергии", rarity: "legendary", icon: "⚡", growthMul: 1.40 }),
    makeBuffCard({ id: "L6", name: "Всевидящее око", desc: "+40% дальность атаки", rarity: "legendary", icon: "📡", unitAtkRangeMul: 1.40 }),
    makeBuffCard({ id: "L7", name: "Крепость богов", desc: "+50% HP, +25% радиус турелей", rarity: "legendary", icon: "🏗️", turretHpMul: 1.50, turretRangeMul: 1.25 }),
    makeBuffCard({ id: "L8", name: "Абсолютная экспансия", desc: "+45% скорость зоны", rarity: "legendary", icon: "🌐", influenceSpeedMul: 1.45 }),
    makeBuffCard({ id: "L9", name: "Мульти-залп", desc: "Каждый патрульный стреляет по +2 целям", rarity: "legendary", icon: "🎯", turretTargetBonus: 2 }),
    makeBuffCard({ id: "L10", name: "Нулевая стоимость", desc: "-30% стоимость кораблей", rarity: "legendary", icon: "💰", unitCostMul: 0.70 }),
    makeBuffCard({ id: "L11", name: "Абсолютно легендарный щит", desc: "+0.5 реген щита/с, +100 Энергии", rarity: "legendary", icon: "🛡️", shieldRegenBonus: 0.5, populationBonus: 100, maxStacks: 3 }),
    makeBuffCard({ id: "P1", name: "Патрульный", desc: "Патруль по границе зоны. Макс. 4", rarity: "legendary", icon: "🔦", patrolBonus: 1, maxStacks: 4 }),

    makeBuffCard({ id: "M1", name: "Цепная молния", desc: "Лазеры перескакивают на врагов", rarity: "mythic", icon: "⚡", attackEffect: "chain", maxStacks: 3 }),
    makeBuffCard({ id: "M2", name: "Криолуч", desc: "Замедляет врага при попадании", rarity: "mythic", icon: "❄️", attackEffect: "cryo", maxStacks: 3 }),
    makeBuffCard({ id: "M3", name: "Плазма-пожар", desc: "Поджигает врагов при попадании", rarity: "mythic", icon: "🔥", attackEffect: "fire", maxStacks: 3 })
  ];

  const ABILITY_CARD_DEFS = ABILITY_DEFS.map((ability) => ({
    id: "A_" + ability.id,
    zone: "ability",
    kind: "ability",
    abilityId: ability.id,
    rarity: ability.cardRarity || "epic",
    name: ability.name,
    desc: ability.desc,
    icon: ability.icon,
    targeting: ability.targeting || "instant"
  }));

  const CARD_DEFS = [...BUFF_CARD_DEFS, ...ABILITY_CARD_DEFS];
  const CARD_DEF_BY_ID = new Map(CARD_DEFS.map((def) => [def.id, def]));
  const ABILITY_DEF_BY_ID = new Map(ABILITY_DEFS.map((def) => [def.id, def]));

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function ensurePlayerCardState(player) {
    if (!player) return null;
    player.nextCardInstanceId = Math.max(1, player.nextCardInstanceId || 1);
    player.buffHand = Array.isArray(player.buffHand) ? player.buffHand : [];
    player.abilityHand = Array.isArray(player.abilityHand) ? player.abilityHand : [];
    player.activeBuffs = Array.isArray(player.activeBuffs) ? player.activeBuffs : [];
    player.legendaryBuffs = Array.isArray(player.legendaryBuffs) ? player.legendaryBuffs : [];
    player.cardStateVersion = player.cardStateVersion || 0;
    player.pendingAbilityCardId = player.pendingAbilityCardId || null;
    player.burnedCards = Array.isArray(player.burnedCards) ? player.burnedCards : [];
    return player;
  }

  function getCardDef(cardId) {
    return CARD_DEF_BY_ID.get(cardId) || null;
  }

  function getAbilityDef(abilityId) {
    return ABILITY_DEF_BY_ID.get(abilityId) || null;
  }

  function getUsageCount(player, cardId) {
    ensurePlayerCardState(player);
    let total = 0;
    const zones = [player.buffHand, player.abilityHand, player.activeBuffs, player.legendaryBuffs];
    for (const zone of zones) {
      for (const entry of zone) {
        if (entry.cardId === cardId) total++;
      }
    }
    return total;
  }

  function chooseWeighted(rng, entries) {
    let total = 0;
    for (const entry of entries) total += Math.max(0, entry.weight || 0);
    if (total <= 0) return entries[0] || null;
    let roll = (rng ? rng() : Math.random()) * total;
    for (const entry of entries) {
      roll -= Math.max(0, entry.weight || 0);
      if (roll <= 0) return entry;
    }
    return entries[entries.length - 1] || null;
  }

  function pickRandomFrom(rng, list) {
    if (!list || list.length === 0) return null;
    const idx = Math.floor((rng ? rng() : Math.random()) * list.length);
    return list[Math.max(0, Math.min(list.length - 1, idx))];
  }

  function buildCandidatePool(player, zone, rarity) {
    return CARD_DEFS.filter((def) => {
      if (def.zone !== zone) return false;
      if (rarity && def.rarity !== rarity) return false;
      if (def.maxStacks != null && getUsageCount(player, def.id) >= def.maxStacks) return false;
      return true;
    });
  }

  function createCardInstance(player, cardDef, now, meta) {
    ensurePlayerCardState(player);
    return {
      instanceId: "card_" + player.id + "_" + player.nextCardInstanceId++,
      cardId: cardDef.id,
      zone: cardDef.zone,
      kind: cardDef.kind,
      addedAt: now || 0,
      originLevel: meta && meta.level ? meta.level : null
    };
  }

  function trimBurnLog(player) {
    while (player.burnedCards.length > 12) player.burnedCards.shift();
  }

  function pushCardToHand(player, instance, now) {
    ensurePlayerCardState(player);
    const zoneName = instance.zone === "ability" ? "abilityHand" : "buffHand";
    const limit = instance.zone === "ability" ? ABILITY_HAND_LIMIT : BUFF_HAND_LIMIT;
    const hand = player[zoneName];
    let burned = null;
    if (hand.length >= limit) {
      burned = hand.shift();
      burned.burnedAt = now || 0;
      player.burnedCards.push({ instanceId: burned.instanceId, cardId: burned.cardId, burnedAt: burned.burnedAt });
      trimBurnLog(player);
    }
    hand.push(instance);
    player.cardStateVersion += 1;
    return { burned, hand: zoneName };
  }

  function drawRandomCardForPlayer(player, options) {
    ensurePlayerCardState(player);
    const now = options && options.now != null ? options.now : 0;
    const rng = options && options.rng ? options.rng : Math.random;
    const typeEntry = chooseWeighted(rng, [
      { id: "buff", weight: DRAW_TYPE_WEIGHTS.buff },
      { id: "ability", weight: DRAW_TYPE_WEIGHTS.ability }
    ]);
    const preferredZone = typeEntry ? typeEntry.id : "buff";
    const rarityEntry = chooseWeighted(rng, Object.keys(RARITY_WEIGHTS).map((key) => ({ id: key, weight: RARITY_WEIGHTS[key] })));
    const preferredRarity = rarityEntry ? rarityEntry.id : "common";

    let pool = buildCandidatePool(player, preferredZone, preferredRarity);
    if (pool.length === 0) pool = buildCandidatePool(player, preferredZone, null);
    if (pool.length === 0) {
      const fallbackZone = preferredZone === "buff" ? "ability" : "buff";
      pool = buildCandidatePool(player, fallbackZone, preferredRarity);
      if (pool.length === 0) pool = buildCandidatePool(player, fallbackZone, null);
    }
    if (pool.length === 0) return { ok: false, reason: "no_cards" };
    const cardDef = pickRandomFrom(rng, pool);
    const instance = createCardInstance(player, cardDef, now, options);
    const overflow = pushCardToHand(player, instance, now);
    return { ok: true, instance, cardDef: clone(cardDef), overflow };
  }

  function removeCardFromHand(player, instanceId) {
    ensurePlayerCardState(player);
    for (const zoneName of ["buffHand", "abilityHand"]) {
      const hand = player[zoneName];
      const idx = hand.findIndex((entry) => entry.instanceId === instanceId);
      if (idx >= 0) {
        const removed = hand.splice(idx, 1)[0];
        player.cardStateVersion += 1;
        if (player.pendingAbilityCardId === instanceId) player.pendingAbilityCardId = null;
        return removed;
      }
    }
    return null;
  }

  function activateBuffCard(player, instanceId, now) {
    ensurePlayerCardState(player);
    const removed = removeCardFromHand(player, instanceId);
    if (!removed) return { ok: false, reason: "not_found" };
    const cardDef = getCardDef(removed.cardId);
    if (!cardDef || cardDef.kind !== "buff") return { ok: false, reason: "wrong_type" };
    const entry = {
      instanceId: removed.instanceId,
      cardId: removed.cardId,
      startedAt: now || 0,
      expiresAt: cardDef.permanent ? null : (now || 0) + (cardDef.durationSec || 0),
      permanent: !!cardDef.permanent
    };
    if (entry.permanent) player.legendaryBuffs.push(entry);
    else player.activeBuffs.push(entry);
    player.cardStateVersion += 1;
    return { ok: true, entry, cardDef: clone(cardDef) };
  }

  function consumeAbilityCard(player, instanceId) {
    ensurePlayerCardState(player);
    const removed = removeCardFromHand(player, instanceId);
    if (!removed) return { ok: false, reason: "not_found" };
    const cardDef = getCardDef(removed.cardId);
    if (!cardDef || cardDef.kind !== "ability") return { ok: false, reason: "wrong_type" };
    return { ok: true, entry: removed, cardDef: clone(cardDef) };
  }

  function expireTimedBuffs(player, now) {
    ensurePlayerCardState(player);
    const before = player.activeBuffs.length;
    player.activeBuffs = player.activeBuffs.filter((entry) => entry.permanent || entry.expiresAt == null || entry.expiresAt > now);
    if (player.activeBuffs.length !== before) player.cardStateVersion += 1;
    return before !== player.activeBuffs.length;
  }

  const api = {
    BUFF_HAND_LIMIT,
    ABILITY_HAND_LIMIT,
    RARITY_WEIGHTS,
    BUFF_DURATION_BY_RARITY,
    ABILITY_DEFS,
    BUFF_CARD_DEFS,
    ABILITY_CARD_DEFS,
    CARD_DEFS,
    ensurePlayerCardState,
    getCardDef,
    getAbilityDef,
    getUsageCount,
    drawRandomCardForPlayer,
    removeCardFromHand,
    activateBuffCard,
    consumeAbilityCard,
    expireTimedBuffs,
    clone
  };

  if (typeof window !== "undefined") window.CardSystem = api;
  if (typeof module !== "undefined") module.exports = api;
})();
