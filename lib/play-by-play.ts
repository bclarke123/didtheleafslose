import type { PlayByPlayResponse, PlayByPlayEvent } from "./nhl-types";

export function distillPlayByPlay(pbp: PlayByPlayResponse): string {
  const playerMap = new Map<number, string>();
  for (const spot of pbp.rosterSpots) {
    playerMap.set(spot.playerId, `${spot.firstName.default} ${spot.lastName.default}`);
  }
  const name = (id: number | undefined) => (id ? playerMap.get(id) ?? `#${id}` : "unknown");

  const teamMap = new Map<number, string>();
  teamMap.set(pbp.homeTeam.id, pbp.homeTeam.abbrev);
  teamMap.set(pbp.awayTeam.id, pbp.awayTeam.abbrev);
  const team = (id: number | undefined) => (id ? teamMap.get(id) ?? "?" : "?");

  const homeId = pbp.homeTeam.id;

  // Decode situationCode: digit1=awayGoalie(1=in,0=pulled), digit2=awaySkaters, digit3=homeSkaters, digit4=homeGoalie
  function strength(code: string | undefined): string {
    if (!code || code.length !== 4) return "5v5";
    const awaySkaters = parseInt(code[1]);
    const homeSkaters = parseInt(code[2]);
    if (awaySkaters === homeSkaters) {
      if (awaySkaters === 5) return "5v5";
      return `${awaySkaters}v${homeSkaters}`;
    }
    return `${awaySkaters}v${homeSkaters}`;
  }

  // Zone from perspective of event owner: O=offensive, D=defensive, N=neutral
  const zoneLabel: Record<string, string> = { O: "OZ", D: "DZ", N: "NZ" };

  // --- Per-period aggregates ---
  const periodAggs = new Map<string, { home: Record<string, number>; away: Record<string, number> }>();

  function getPeriodLabel(ev: PlayByPlayEvent): string {
    const pd = ev.periodDescriptor;
    if (pd.periodType === "OT") return "OT";
    if (pd.periodType === "SO") return "SO";
    return `P${pd.number}`;
  }

  function ensurePeriod(label: string) {
    if (!periodAggs.has(label)) {
      const blank = () => ({ shots: 0, hits: 0, takeaways: 0, giveaways: 0, blocks: 0, faceoffWins: 0, missedShots: 0 });
      periodAggs.set(label, { home: blank(), away: blank() });
    }
    return periodAggs.get(label)!;
  }

  // --- Chronological event log ---
  const eventLog: string[] = [];

  for (const ev of pbp.plays) {
    const pLabel = getPeriodLabel(ev);
    const agg = ensurePeriod(pLabel);
    const d = ev.details;
    const ownerId = d?.eventOwnerTeamId;
    const side = ownerId === homeId ? "home" : "away";
    const str = strength(ev.situationCode);
    const zone = d?.zoneCode ? zoneLabel[d.zoneCode] ?? d.zoneCode : "";

    switch (ev.typeDescKey) {
      case "shot-on-goal":
        agg[side].shots++;
        eventLog.push(`${pLabel} ${ev.timeInPeriod} [${str}]: ${team(ownerId)} shot on goal by ${name(d?.shootingPlayerId)} (${d?.shotType ?? "?"}, ${zone})`);
        break;
      case "missed-shot":
        agg[side].missedShots++;
        break;
      case "blocked-shot":
        agg[side].blocks++;
        eventLog.push(`${pLabel} ${ev.timeInPeriod} [${str}]: ${team(ownerId)} ${name(d?.blockingPlayerId)} blocked shot from ${name(d?.shootingPlayerId)} (${zone})`);
        break;
      case "hit":
        agg[side].hits++;
        eventLog.push(`${pLabel} ${ev.timeInPeriod} [${str}]: ${team(ownerId)} ${name(d?.hittingPlayerId)} hit ${name(d?.hitteePlayerId)} (${zone})`);
        break;
      case "takeaway":
        agg[side].takeaways++;
        eventLog.push(`${pLabel} ${ev.timeInPeriod} [${str}]: ${team(ownerId)} takeaway by ${name(d?.playerId)} (${zone})`);
        break;
      case "giveaway":
        agg[side].giveaways++;
        eventLog.push(`${pLabel} ${ev.timeInPeriod} [${str}]: ${team(ownerId)} giveaway by ${name(d?.playerId)} (${zone})`);
        break;
      case "faceoff":
        if (ownerId === homeId) agg.home.faceoffWins++;
        else agg.away.faceoffWins++;
        eventLog.push(`${pLabel} ${ev.timeInPeriod} [${str}]: Faceoff won by ${team(ownerId)} ${name(d?.winningPlayerId)} over ${name(d?.losingPlayerId)} (${zone})`);
        break;
      case "goal":
        eventLog.push(`${pLabel} ${ev.timeInPeriod} [${str}]: *** GOAL *** ${team(ownerId)} ${name(d?.scoringPlayerId)}${d?.assist1PlayerId ? ` from ${name(d.assist1PlayerId)}` : ""}${d?.assist2PlayerId ? `, ${name(d.assist2PlayerId)}` : ""} (${d?.shotType ?? "?"}, ${zone}) - ${d?.awayScore}-${d?.homeScore}`);
        break;
      case "penalty":
        eventLog.push(`${pLabel} ${ev.timeInPeriod} [${str}]: PENALTY ${team(ownerId)} ${name(d?.committedByPlayerId)} - ${d?.descKey} ${d?.duration}min${d?.drawnByPlayerId ? ` drawn by ${name(d.drawnByPlayerId)}` : ""}`);
        break;
      case "stoppage":
        if (d?.reason === "icing" || d?.reason === "offside") {
          eventLog.push(`${pLabel} ${ev.timeInPeriod}: Stoppage - ${d.reason}`);
        }
        break;
    }
  }

  // --- Format period aggregates ---
  const aggLines: string[] = [];
  const hAbbrev = pbp.homeTeam.abbrev;
  const aAbbrev = pbp.awayTeam.abbrev;
  Array.from(periodAggs.entries()).forEach(([period, { home, away }]) => {
    aggLines.push(`${period}: ${aAbbrev} ${away.shots}SOG/${away.hits}H/${away.takeaways}TK/${away.giveaways}GV/${away.blocks}BLK/${away.faceoffWins}FOW/${away.missedShots}MISS | ${hAbbrev} ${home.shots}SOG/${home.hits}H/${home.takeaways}TK/${home.giveaways}GV/${home.blocks}BLK/${home.faceoffWins}FOW/${home.missedShots}MISS`);
  });

  return `PERIOD-BY-PERIOD STATS:\n${aggLines.join("\n")}\n\nPLAY-BY-PLAY LOG:\n${eventLog.join("\n")}`;
}
