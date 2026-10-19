import { GOTRAS } from "@/lib/seva/domain/gotras";
import { counterPickLists } from "@/lib/seva/domain/lists";
import { NAKSHATRAS } from "@/lib/seva/domain/nakshatras";
import { RASHIS } from "@/lib/seva/domain/rashis";
import type { SevaListItem, SevaLists } from "@/types/seva";

/** The counter's gotra, nakshatra and rashi pick lists (plan A4P-5): the bootstrap's lists over the built-in ones. */

function item(p: Partial<SevaListItem> & Pick<SevaListItem, "id" | "nameEn">): SevaListItem {
  return { nameKn: null, knChecked: false, active: true, displayOrder: p.id, ...p };
}

const LISTS: SevaLists = {
  gotras: [
    item({ id: 1000, nameEn: "Vyaghrapada", nameKn: "ವ್ಯಾಘ್ರಪಾದ", displayOrder: 57 }),
    item({ id: 0, nameEn: "Not known", nameKn: "ಗೊತ್ತಿಲ್ಲ" }),
    item({ id: 1, nameEn: "Kashyapa", nameKn: "ಕಾಶ್ಯಪ" }),
    item({ id: 12, nameEn: "Shandilya", nameKn: "ಶಾಂಡಿಲ್ಯ", active: false }),
    item({ id: 1001, nameEn: "Kutsa Angirasa", displayOrder: 58 }),
  ],
  nakshatras: NAKSHATRAS.map((n) => item({ id: n.id, nameEn: n.en, nameKn: n.id === 25 ? "ಪೂರ್ವಾಭಾದ್ರಪದ" : n.kn, knChecked: n.id === 25 })),
  rashis: RASHIS.map((r) => item({ id: r.id, nameEn: r.en, nameKn: r.kn })),
};

describe("counter pick lists", () => {
  it("the counter uses bootstrap lists, falls back to built-in ones offline, and hides hidden gotras", () => {
    const lists = counterPickLists(LISTS);

    // Bootstrap gotras in display order; the hidden one is not offered, a new one is, and built-in aliases stay.
    expect(lists.gotras.map((g) => g.id)).toEqual([0, 1, 1000, 1001]);
    expect(lists.gotras.find((g) => g.id === 1000)).toEqual({ id: 1000, en: "Vyaghrapada", kn: "ವ್ಯಾಘ್ರಪಾದ", aliases: [] });
    expect(lists.gotras.find((g) => g.id === 1001)?.kn).toBe("");
    expect(lists.gotras.find((g) => g.id === 1)?.aliases).toEqual(GOTRAS.find((g) => g.id === 1)?.aliases);

    // Nakshatra and rashi names stay as built in; only a corrected Kannada spelling comes from the bootstrap.
    const purva = lists.nakshatras.find((n) => n.id === 25);
    expect(purva).toEqual({ ...NAKSHATRAS[24], kn: "ಪೂರ್ವಾಭಾದ್ರಪದ" });
    expect(lists.nakshatras).toHaveLength(27);
    expect(lists.rashis).toEqual(RASHIS);

    // A bootstrap cached before the lists existed (or none at all, offline on a fresh PC): the built-in lists.
    const fallback = counterPickLists(undefined);
    expect(fallback.gotras).toEqual(GOTRAS);
    expect(fallback.nakshatras).toEqual(NAKSHATRAS);
    expect(fallback.rashis).toEqual(RASHIS);

    // An empty list is never offered: that kind falls back to the built-in list.
    const empty = counterPickLists({ gotras: [], nakshatras: [], rashis: [] });
    expect(empty.gotras).toEqual(GOTRAS);
    expect(empty.nakshatras).toEqual(NAKSHATRAS);
  });

  it("keeps the built-in English names of nakshatras and rashis even if the bootstrap sends others", () => {
    const odd: SevaLists = { ...LISTS, rashis: [item({ id: 1, nameEn: "Aries", nameKn: "ಮೇಷ ರಾಶಿ" })] };
    const lists = counterPickLists(odd);
    expect(lists.rashis[0]).toEqual({ ...RASHIS[0], kn: "ಮೇಷ ರಾಶಿ" });
    // Rashis the bootstrap did not mention keep their built-in Kannada.
    expect(lists.rashis.slice(1)).toEqual(RASHIS.slice(1));
  });
});
