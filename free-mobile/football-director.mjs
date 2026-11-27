const roles = {
  BACKGROUND: [.96, 46, 0, 130, 'football_pro'],
  SETUP: [.98, 50, 0, 100, 'football_pro'],
  BUILD: [1.02, 57, 0, 80, 'football_pro'],
  ATTACK: [1.06, 62, 0, 55, 'football_pro'],
  PRESSURE: [1.08, 68, 0, 55, 'football_passion'],
  BREAKTHROUGH: [1.06, 65, 0, 60, 'football_passion'],
  SHOT: [1.08, 70, 110, 65, 'football_passion'],
  GOAL: [1.05, 88, 75, 220, 'football_goal'],
  DECISIVE: [1.03, 94, 100, 260, 'football_goal'],
  SETBACK: [.96, 48, 0, 150, 'football_pro'],
  EMOTIONAL: [.95, 52, 0, 150, 'football_warm'],
  WARM: [.95, 48, 0, 125, 'football_warm'],
  MEMORY: [.94, 46, 0, 170, 'football_warm'],
  CLOSING: [.95, 46, 0, 0, 'football_pro'],
};

function classify(text, previous, final) {
  if (/差一点|差点|险些|错失|没能|未能|没有进球|不进|打偏|被取消|进球无效|出局|扳平未果/.test(text)) return 'SETBACK';
  if (/[？?]\s*$|核查|待确认|进球数|进球纪录|本赛季.*粒|上赛季.*粒/.test(text)) return 'BACKGROUND';
  if (/完成绝杀|绝杀了|反超(?:了|比分)|成功晋级|锁定晋级|关键扑救|扑出了制胜点球/.test(text)) return 'DECISIVE';
  if (/球进了|打进(?:了|一球)|破门(?:了|！|!)|进球了/.test(text)) return 'GOAL';
  if (/这是属于|这一刻|创造了历史|值得铭记/.test(text)) return 'EMOTIONAL';
  if (/终场|故事还在继续|这就是足球|比赛结束/.test(text)) return 'CLOSING';
  if (/孩子|少年|陪伴|热爱|家乡/.test(text)) return 'WARM';
  if (/回忆|多年以后|多年以前|岁月/.test(text)) return 'MEMORY';
  if (/低射|抽射|射门|打门|主罚点球/.test(text)) return 'SHOT';
  if (/抢断|断球|突破|转换/.test(text)) return 'BREAKTHROUGH';
  if (/禁区|单刀|门前|压迫/.test(text)) return 'PRESSURE';
  if (/反击|推进|调整|传中|晃开/.test(text)) return 'ATTACK';
  if (/逼近|节奏|蓄势|战成|相持/.test(text)) return 'BUILD';
  if (/开场|第.{1,5}分钟|下半场|点球大战/.test(text)) return 'SETUP';
  if (final && (previous === 'GOAL' || previous === 'DECISIVE')) return 'CLOSING';
  return 'BACKGROUND';
}

export function planFootball(text) {
  // Keep every character, including whitespace and punctuation.
  const sentences = text.match(/[^。！？!?；;\n]*[。！？!?；;\n]+|[^。！？!?；;\n]+$/gu) || [];
  const phrases = sentences.flatMap(sentence => sentence.split(/(?<=[，,])(?=\s*(?:球进了|绝杀了|完成绝杀|成功晋级|这是属于|左脚低射|右脚低射|第.{1,5}分钟))/u));
  let previous;
  return phrases.map((phrase, index) => {
    const type = classify(phrase, previous, index === phrases.length - 1);
    const emphasis = type === 'GOAL' || type === 'DECISIVE';
    const recover = !emphasis && (previous === 'GOAL' || previous === 'DECISIVE');
    const [speed, intensity, pauseBefore, pauseAfter, style] = roles[type];
    previous = type;
    return {text:phrase, type, speed:recover ? Math.min(.98,speed) : speed,
      intensity:recover ? Math.min(52,intensity) : intensity, pauseBefore, pauseAfter,
      emphasis, emotion:recover ? 'recovery' : type.toLowerCase(),
      style:recover && style === 'football_passion' ? 'football_pro' : style};
  });
}

export function estimateDuration(plan, speed = 1) {
  return plan.reduce((total, item) => total +
    (item.text.match(/[\p{L}\p{N}]/gu)?.length || 0) / (4.6 * item.speed * speed) +
    (item.pauseBefore + item.pauseAfter) / 1000, 0);
}

export function boundedSpeed(ratio) {
  return Math.max(.82, Math.min(1.2, ratio));
}

export function groupDirectorPlan(plan) {
  const grouped=[];
  for(const item of plan){
    const last=grouped.at(-1);
    // Keep event beats and the first recovery separate.
    if(last && last.type===item.type && !item.emphasis && last.emotion===item.emotion
        && item.emotion!=='recovery' && last.text.length+item.text.length<=120){
      last.text+=item.text;
      last.pauseAfter=item.pauseAfter;
    }else grouped.push({...item});
  }
  return grouped;
}
