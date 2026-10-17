export const meta = {
  name: 'temple-portal-brain-refresh',
  description: 'Refresh the 16 brain files against four weeks of commits, build M17 for the new mobile app / Prisma / .ai loop, verify, then propagate to the router, docs, HTML and the two decision reports',
  phases: [
    { title: 'Refresh', detail: 'one Opus-high refresher per changed module; M17 built fresh', model: 'opus' },
    { title: 'Verify', detail: 'one Opus-high skeptic per module with five or more changed files', model: 'opus' },
    { title: 'Propagate', detail: 'router + docs + HTML (role A); fault register, recommendation reality check, re-based roadmap, UI plan status (role B) with a skeptic', model: 'opus' },
  ],
}

const { items, paths, today, head } = args
const S = { type: 'string' }, I = { type: 'integer' }, B = { type: 'boolean' }
const A = x => ({ type: 'array', items: x })
const O = props => ({ type: 'object', properties: props, required: Object.keys(props) })

const REFRESH_SCHEMA = O({ chunk: S, filesAdded: I, filesDeleted: I, filesModified: I, claimsCorrected: I, faultsFixed: I, faultsStillOpen: I, faultsNew: I, mobileConsumesThisModule: B, significantChanges: A(S), file: S, notes: S })
const BUILD_SCHEMA = O({ chunk: S, title: S, filesExpected: I, filesMentioned: I, file: S, findings: A(O({ id: S, severity: S, summary: S, evidence: S })), portabilitySummary: S, unclear: A(S), notes: S })
const VERIFY_SCHEMA = O({ chunk: S, pathsChecked: I, pathsBroken: I, pathsFixed: I, claimsSampled: I, claimsConfirmed: I, claimsRefuted: I, claimsUncertain: I, findingsReviewed: I, findingsConfirmed: I, findingsRefuted: I, findingsAdded: I, filesUnmentionedBefore: I, filesAddedToBrain: I, focusQuestionsUnanswered: A(S), file: S, notes: S })
const A_SCHEMA = O({ role: S, filesEdited: A(S), brokenLinks: I, htmlExternalResources: I, modulesInMap: I, whatChangedLines: I, notes: S })
const B_SCHEMA = O({ role: S, registerBefore: O({ HIGH: I, MEDIUM: I, LOW: I }), registerAfter: O({ HIGH: I, MEDIUM: I, LOW: I }), fixed: I, stillOpen: I, newRows: I, recommendationStands: B, mobileMatchesOptionB: S, phases0to2Done: S, rebasedPhase2Gate: S, uiRowsResolved: I, specimenColoursStillInGlobals: B, filesEdited: A(S), notes: S })
const BS_SCHEMA = O({ sectionsChecked: A(S), claimsRefuted: I, arithmeticErrors: I, editsMade: I, recommendationStands: B, file: S, notes: S })

const cwd = `IMPORTANT: your shell starts in a DIFFERENT folder. Begin every shell command with: cd "${paths.root}" - and use absolute paths under ${paths.root} for every file you read or write. Never touch ${paths.snapshot} except to read or diff.`
const head_ = brief => `Read ${paths.briefs}/RULES.md first, then your brief in full and do exactly what it says: ${paths.briefs}/${brief}. ${cwd} Today is ${today}; HEAD is ${head}. Work alone; never ask questions; do not spawn subagents. Your final text is a return value read by a script: return only the structured summary.`
const brainFile = it => `${paths.brain}/${it.id}-${it.slug}.md`
const opus = (label, phase, schema, effort) => ({ label, phase, schema, model: 'opus', effort })

const results = await pipeline(items,
  it => it.mode === 'build'
    ? agent(`${head_('BUILD.brief.md')}\nYou own the NEW chunk ${it.id} - "${it.title}". Your chunk entry is in ${paths.chunks} (id ${it.id}); your inventory is ${paths.inventory}/${it.id}.json. This chunk did not exist on 2026-09-19; write its brain file from scratch to ${brainFile(it)}, dated ${today}, and compare what you find with docs/rearchitecture/REACT-NATIVE-MIGRATION-AND-FAULTS.md section 4 as the focus questions ask.`, opus(`build:${it.id}`, 'Refresh', BUILD_SCHEMA, 'high'))
    : agent(`${head_('REFRESH.brief.md')}\nYou own chunk ${it.id} - "${it.title}". Brain file: ${brainFile(it)}. Delta: ${it.delta} changed files listed under perModule.${it.id} in ${paths.delta}.`, opus(`refresh:${it.id}`, 'Refresh', REFRESH_SCHEMA, 'high')),
  (r, it) => {
    if (!r) { log(`${it.id}: agent returned nothing`); return { chunk: it.id, result: null, verified: null } }
    log(it.mode === 'build' ? `${it.id}: built ${r.filesMentioned}/${r.filesExpected} files, ${r.findings.length} findings` : `${it.id}: +${r.filesAdded} -${r.filesDeleted} ~${r.filesModified}, ${r.claimsCorrected} claims corrected, faults fixed ${r.faultsFixed} / open ${r.faultsStillOpen} / new ${r.faultsNew}`)
    if (!it.verify) return { chunk: it.id, result: r, verified: 'skipped (delta < 5 files)' }
    return agent(`You are the skeptic for chunk ${it.id} - "${it.title}". ${it.mode === 'build' ? 'A builder has just written' : 'A refresher has just updated'} the brain file at ${brainFile(it)}. REFUTE its claims against today's code, do not agree with them. ${head_('VERIFY.brief.md')}\nFocus your sampling on the sections the ${it.mode === 'build' ? 'builder wrote' : 'Refresh log (' + today + ') says changed'} and on every fault row marked FIXED or new. Write your report to ${paths.verify}/${it.id}-${today}.md (do not overwrite the 2026-09-19 report).\nUPSTREAM RESULT: ${JSON.stringify(r)}`, opus(`verify:${it.id}`, 'Verify', VERIFY_SCHEMA, 'high'))
      .then(v => { if (v) log(`${it.id}: verified - ${v.claimsRefuted}/${v.claimsSampled} refuted, ${v.pathsBroken} paths broken, +${v.findingsAdded} findings`); else log(`${it.id}: skeptic returned nothing`); return { chunk: it.id, result: r, verified: v } })
  })

const done = results.filter(Boolean)
const missing = items.map(i => i.id).filter(id => !done.find(d => d.chunk === id && d.result))
log(`refresh+verify: ${done.filter(d => d.result).length}/${items.length}${missing.length ? ' - MISSING ' + missing.join(',') : ''}`)
const summaries = done.filter(d => d.result).map(d => ({ chunk: d.chunk, significantChanges: d.result.significantChanges || d.result.notes, faultsFixed: d.result.faultsFixed, faultsNew: d.result.faultsNew, mobile: d.result.mobileConsumesThisModule }))

const [a, b] = await parallel([
  () => agent(`${head_('SYNTH-REFRESH.brief.md')}\nYou have ROLE A. Missing brain refreshes: ${missing.length ? missing.join(', ') : 'none'}.\nREFRESHER RESULTS: ${JSON.stringify(summaries)}`, opus('propagate:A-router-docs', 'Propagate', A_SCHEMA, 'high'))
    .then(x => { if (x) log(`A: ${x.filesEdited.length} files, broken links ${x.brokenLinks}, html external ${x.htmlExternalResources}, modules ${x.modulesInMap}`); return x }),
  () => agent(`${head_('SYNTH-REFRESH.brief.md')}\nYou have ROLE B.\nREFRESHER RESULTS: ${JSON.stringify(summaries)}`, opus('propagate:B-reports', 'Propagate', B_SCHEMA, 'xhigh'))
    .then(async bx => {
      if (!bx) { log('B returned nothing'); return { b: null, bs: null } }
      log(`B: register ${bx.registerBefore.HIGH}/${bx.registerBefore.MEDIUM}/${bx.registerBefore.LOW} -> ${bx.registerAfter.HIGH}/${bx.registerAfter.MEDIUM}/${bx.registerAfter.LOW}, fixed ${bx.fixed}, new ${bx.newRows}, recommendation ${bx.recommendationStands ? 'stands' : 'CHANGED'}, mobile vs B: ${bx.mobileMatchesOptionB}, phases 0-2 done: ${bx.phases0to2Done}`)
      const bs = await agent(`You are the skeptic for the ${today} update of docs/rearchitecture/REACT-NATIVE-MIGRATION-AND-FAULTS.md and UI-REDESIGN-PLAN.md. REFUTE, do not agree. Read ${paths.briefs}/RULES.md, then ${paths.briefs}/SYNTH-REFRESH.brief.md Role B to know what was supposed to change. ${cwd} Today is ${today}; HEAD is ${head}.\nCheck: (1) section 2.4 - sample 20 register rows marked FIXED and open the brain fault row and the commit named; (2) section 4.4 - every claim about apps/mobile against the M17 brain file and the code; (3) the re-based roadmap arithmetic from Monday 2026-10-19, Mon-Fri, no holidays - recompute every date; (4) totals in the executive summary against the register; (5) the UI plan's RESOLVED rows against the code. Correct in place; append a dated Reviewer notes entry to each file; write ${paths.verify}/B-skeptic-${today}.md. Return only the structured summary.\nAUTHOR RESULT: ${JSON.stringify(bx)}`, opus('verify:B-skeptic', 'Propagate', BS_SCHEMA, 'xhigh'))
      if (bs) log(`B-skeptic: ${bs.claimsRefuted} refuted, ${bs.arithmeticErrors} arithmetic errors, ${bs.editsMade} edits, recommendation ${bs.recommendationStands ? 'stands' : 'CHANGED'}`)
      return { b: bx, bs }
    }),
])

return {
  perChunk: done.map(d => ({ chunk: d.chunk, result: d.result ? (d.result.filesMentioned !== undefined ? `built ${d.result.filesMentioned}/${d.result.filesExpected}` : `+${d.result.filesAdded} -${d.result.filesDeleted} ~${d.result.filesModified}, corrected ${d.result.claimsCorrected}, fixed ${d.result.faultsFixed}, new ${d.result.faultsNew}`) : null, verified: typeof d.verified === 'string' ? d.verified : d.verified ? `${d.verified.claimsRefuted}/${d.verified.claimsSampled} refuted, +${d.verified.findingsAdded}` : 'skeptic returned nothing', significant: d.result ? d.result.significantChanges : null })),
  missing,
  roleA: a || null,
  roleB: b ? b.b : null,
  roleBSkeptic: b ? b.bs : null,
}
