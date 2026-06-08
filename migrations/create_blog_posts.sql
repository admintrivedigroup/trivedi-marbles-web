-- Run this migration in the Supabase SQL editor to add the blog_posts table.
-- Stores journal/blog posts managed from the inventory admin panel.

CREATE TABLE IF NOT EXISTS blog_posts (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT        NOT NULL,
  category     TEXT        NOT NULL DEFAULT '',
  date         DATE        NOT NULL DEFAULT CURRENT_DATE,
  excerpt      TEXT        NOT NULL DEFAULT '',
  cover_image  TEXT        NOT NULL DEFAULT '',
  content      TEXT[]      NOT NULL DEFAULT '{}',
  published    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION update_blog_posts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_blog_posts_updated_at
  BEFORE UPDATE ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION update_blog_posts_updated_at();

ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

-- Anonymous visitors can read published posts (for the public website)
CREATE POLICY "anon_select_published" ON blog_posts
  FOR SELECT TO anon
  USING (published = true);

-- Authenticated users (admin panel) can read all posts including drafts
CREATE POLICY "auth_select_all" ON blog_posts
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "auth_insert" ON blog_posts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update" ON blog_posts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth_delete" ON blog_posts FOR DELETE TO authenticated USING (true);

-- ─── Seed: existing journal posts ────────────────────────────────────────────

INSERT INTO blog_posts (title, category, date, excerpt, cover_image, content, published) VALUES (
  $str$The Rise of Fusion Black in Modern Architecture$str$,
  $str$Design Trends$str$,
  '2026-04-02',
  $str$Discover how the deep black hues and radiant gold streams of Fusion Black are redefining luxury commercial spaces worldwide.$str$,
  $str$https://images.unsplash.com/photo-1643034738686-d69e7bc047e1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBtYXJibGUlMjBtb2Rlcm4lMjBpbnRlcmlvcnxlbnwxfHx8fDE3NzUyOTYxNjh8MA&ixlib=rb-4.1.0&q=80&w=1080$str$,
  ARRAY[
    $str$In the world of luxury stone, few materials command attention quite like Fusion Black. Characterised by its near-obsidian base shot through with molten veins of gold and ivory, it has become the signature choice for designers seeking drama without excess. Over the past decade, its presence has grown from boutique hotel lobbies to flagship retail spaces, penthouse kitchens, and statement staircases in some of the world's most celebrated residences.$str$,
    $str$The appeal lies in its inherent tension. Black marble has long been associated with authority and sophistication, but Fusion Black introduces a warmth through its golden streaks that prevents it from feeling cold or oppressive. When light — natural or artificial — moves across a large slab, the veining appears to shift, giving walls and floors an almost living quality that no other material can replicate.$str$,
    $str$Architects today are specifying Fusion Black in ways that would have been considered bold even five years ago. Full-height feature walls behind reception desks, monolithic bathroom enclosures where walls, floors, and vanities are cut from the same block, and kitchen islands that double as sculptural focal points are now standard applications. The key lies in restraint elsewhere: pair Fusion Black with pale plaster, raw linen, and brushed brass hardware and it sings without overwhelming.$str$,
    $str$At Trivedi Marbles, our Fusion Black is sourced directly from D.K. Trivedi & Sons Quarry, where each slab is carefully selected for consistent veining depth and surface uniformity. We offer it in both a high gloss finish — which maximises the drama of the gold patterning — and a leathered finish for spaces where a more tactile, understated luxury is the goal. If you are considering Fusion Black for your next project, we invite you to visit our Ahmedabad showroom to experience the slabs in person before making your selection.$str$
  ],
  true
);

INSERT INTO blog_posts (title, category, date, excerpt, cover_image, content, published) VALUES (
  $str$Journey to the Source: Ethical Stone Extraction$str$,
  $str$Sustainability$str$,
  '2026-03-28',
  $str$A closer look at Trivedi Marbles' sustainable quarrying practices and our commitment to preserving natural landscapes.$str$,
  $str$https://images.unsplash.com/photo-1715527942060-25e03feb5720?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtYXJibGUlMjBzdG9uZSUyMHF1YXJyeSUyMG5hdHVyZXxlbnwxfHx8fDE3NzUyOTYxNzF8MA&ixlib=rb-4.1.0&q=80&w=1080$str$,
  ARRAY[
    $str$The story of every marble slab begins long before it reaches a showroom floor. It begins in the earth — in our case, in the hills of Ambaji, Gujarat, where D.K. Trivedi & Sons has operated its quarry since 1949. Visiting the quarry today is a study in the balance between industry and stewardship: diamond-wire cutting machines work with surgical precision to extract blocks with minimal waste, while the surrounding landscape is managed under a restoration programme that has been running for over two decades.$str$,
    $str$Ethical quarrying is not simply about what you take from the earth — it is equally about what you put back. Our operations adhere to a strict land rehabilitation policy: for every section of quarry face worked, a corresponding area is progressively backfilled and revegetated. Water used in the cutting process is fully recycled on site, and we have invested significantly in dust suppression technology to protect the health of our workers and the communities that border our operations.$str$,
    $str$Waste stone — the offcuts and fragments that result from block extraction — has traditionally been one of the industry's most visible environmental problems. At D.K. Trivedi & Sons, we have worked to turn this into an advantage. Smaller offcuts are processed into tiles, mosaics, and architectural cladding pieces that carry the same quality as our premium slabs. The finest powder residue from cutting is used in the production of composite materials. The result is a near-zero-waste quarrying operation that we are genuinely proud of.$str$,
    $str$We believe that luxury and responsibility are not in conflict. When a designer or homeowner chooses Trivedi Marbles, they are choosing stone that has been extracted with care for the people who mine it, the land it comes from, and the generations who will inherit that land. We are committed to continuing to raise our standards and to being transparent about our practices — because the true value of natural stone is inseparable from the integrity of how it is obtained.$str$
  ],
  true
);

INSERT INTO blog_posts (title, category, date, excerpt, cover_image, content, published) VALUES (
  $str$Caring for Your Calacatta Gold: A Definitive Guide$str$,
  $str$Maintenance$str$,
  '2026-03-15',
  $str$Expert advice on cleaning, sealing, and protecting your premium white marble surfaces to ensure they last generations.$str$,
  $str$https://images.unsplash.com/photo-1773291933997-78596fe8b0a5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjbGVhbiUyMG1pbmltYWxpc3QlMjBtYXJibGUlMjBkZXRhaWx8ZW58MXx8fHwxNzc1Mjk2MTc0fDA&ixlib=rb-4.1.0&q=80&w=1080$str$,
  ARRAY[
    $str$Calacatta Gold is among the most coveted marbles in the world — its bright white ground and dramatic warm-gold veining have graced the interiors of palaces, temples, and contemporary masterpieces alike. It is also, by the nature of its composition, a material that rewards attentive care. Understanding how to clean, seal, and protect your Calacatta Gold surfaces is not just a matter of maintenance; it is an investment in ensuring that their beauty endures for generations.$str$,
    $str$The first principle of marble care is prevention. Calacatta Gold, like all calcite-based stones, is sensitive to acids. Red wine, citrus juice, vinegar, and even many common household cleaners will etch the surface if left in contact, dulling the polish and leaving dull marks that are difficult to reverse. The simplest protection is habit: wipe spills immediately with a clean, damp cloth and avoid placing acidic items directly on polished surfaces. Use coasters, trivets, and chopping boards as a matter of course.$str$,
    $str$Sealing is the second pillar of care. A quality penetrating sealer applied every twelve to eighteen months creates a barrier within the stone's pores that resists staining from oils, coloured liquids, and moisture. The process is straightforward: ensure the surface is clean and fully dry, apply the sealer evenly with a soft cloth, allow it to penetrate for the time specified by the manufacturer, then buff away any excess before it dries on the surface. Avoid topical sealers, which sit on the surface and can alter the appearance of the stone.$str$,
    $str$For routine cleaning, warm water and a pH-neutral stone soap are all you need. Apply with a soft microfibre cloth, rinse thoroughly, and dry immediately to prevent water marks. For floors, a flat-head mop with a microfibre pad is ideal. If your marble has developed light etching or surface scratches over time, do not attempt to remedy this yourself with abrasive compounds — contact a professional stone restorer who can re-hone or re-polish the affected areas to their original specification. With the right care regime, your Calacatta Gold will age not just gracefully, but gloriously.$str$
  ],
  true
);

INSERT INTO blog_posts (title, category, date, excerpt, cover_image, content, published) VALUES (
  $str$The Timeless Appeal of Exotic Green$str$,
  $str$Material Focus$str$,
  '2026-02-22',
  $str$Why the earthy beige tones of Travertine continue to add warmth and classical elegance to modern minimalist designs.$str$,
  $str$https://images.unsplash.com/photo-1673157056688-041d5b5e7d5a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiZWlnZSUyMHRyYXZlcnRpbmUlMjBtYXJibGUlMjB0ZXh0dXJlfGVufDF8fHx8MTc3NTIwMTIzNXww&ixlib=rb-4.1.0&q=80&w=1080$str$,
  ARRAY[
    $str$In an era dominated by white and grey stone palettes, Exotic Green stands apart as a material of unmistakable character. Its deep emerald and forest-green tones, interlaced with white calcite veins and occasional amber inclusions, speak to a geological history that no manufactured surface can imitate. It is a stone that carries the memory of the earth within it, and that quality translates directly into the spaces it inhabits.$str$,
    $str$The resurgence of green in contemporary interiors has elevated Exotic Green from a niche choice to a sought-after statement material. Interior designers drawn to biophilic principles — design philosophies that seek to reconnect occupants with the natural world — have found in it a perfect ally. A full-height Exotic Green feature wall brings the density and calm of a forest interior into a living room; a bathroom clad in it feels simultaneously primal and deeply luxurious.$str$,
    $str$What distinguishes Exotic Green from other decorative stones is its versatility of finish. In a high gloss polish, the colours intensify and the veining takes on an almost jewel-like quality. Brushed or leathered, the surface becomes more textural and earthy, lending itself beautifully to outdoor terraces, landscape features, and spaces where a more organic aesthetic is desired. It is equally at home in a modernist interior and in a traditional or heritage setting.$str$,
    $str$Trivedi Marbles offers Exotic Green in slab form for bespoke applications and as a curated range of standard sizes for those working within tighter project parameters. Each slab is individually photographed and catalogued, allowing architects and designers to book-match or select specific pieces for their projects. We recommend viewing Exotic Green in natural light before specifying, as its tones shift beautifully throughout the day — a quality that few photographs can fully capture.$str$
  ],
  true
);

INSERT INTO blog_posts (title, category, date, excerpt, cover_image, content, published) VALUES (
  $str$Integrating Marble in Luxury Bathroom Concepts$str$,
  $str$Interior Design$str$,
  '2026-02-10',
  $str$From monolithic statuario vanity tops to full-slab shower walls, learn how to elevate your private sanctuaries.$str$,
  $str$https://images.unsplash.com/photo-1658760046471-896cbc719c9d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBtYXJibGUlMjBiYXRocm9vbXxlbnwxfHx8fDE3NzUyMDEyMzV8MA&ixlib=rb-4.1.0&q=80&w=1080$str$,
  ARRAY[
    $str$The bathroom has evolved from a purely functional space into one of the most considered rooms in the home. For those who understand the transformative power of natural stone, marble remains the material of choice — not merely as a finish, but as the architectural language of the entire space. Used with intention, it can turn a bathroom into a private sanctuary that rivals the finest hotel suites in the world.$str$,
    $str$The most impactful way to use marble in a bathroom is to commit to it fully. Rather than introducing stone as a single element — a vanity top, a floor tile — consider specifying it across all primary surfaces: walls, floors, bath surround, and ceiling niche. When the same marble runs continuously across multiple planes, the space achieves a sense of coherence and luxury that tiled bathrooms, however well executed, cannot match. This approach works best with stones that have a relatively consistent patterning, such as Ambaji White or Calacatta Gold, where the veining flows naturally from surface to surface.$str$,
    $str$Wet areas demand particular consideration. The floor of a shower enclosure or a wet room needs a finish that provides grip without sacrificing beauty. A lightly brushed or honed finish achieves this, and for additional safety, a custom cut pattern — herringbone, basketweave, or simple linear strips — can be introduced to the floor while keeping wall surfaces in a smoother finish. The contrast between finishes on the same stone adds visual depth and a considered craftsmanship that elevates the entire room.$str$,
    $str$The details matter enormously in a marble bathroom. Thin edge profiles on vanity tops, seamless book-matched shower walls, and recessed niches cut from single pieces of stone all contribute to the sense that the room has been designed rather than assembled. Work with a supplier who can provide slabs large enough for your intended application and who will assist with layout planning before cutting begins. At Trivedi Marbles, our team regularly collaborates directly with interior designers and contractors to ensure that the vision for a space is faithfully realised in stone.$str$
  ],
  true
);

INSERT INTO blog_posts (title, category, date, excerpt, cover_image, content, published) VALUES (
  $str$Understanding Veining Patterns and Bookmatching$str$,
  $str$Architecture$str$,
  '2026-01-28',
  $str$An architect's overview of selecting and aligning consecutive slabs to create breathtaking mirrored focal walls.$str$,
  $str$https://images.unsplash.com/photo-1768223933860-6d62bc5b2ff3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBtb2Rlcm4lMjBhcmNoaXRlY3R1cmUlMjBidWlsZGluZ3xlbnwxfHx8fDE3NzUxNDY0NjJ8MA&ixlib=rb-4.1.0&q=80&w=1080$str$,
  ARRAY[
    $str$Of all the techniques available to architects and designers working with natural stone, bookmatching stands among the most dramatic. The process is conceptually simple: two consecutive slabs cut from the same block are opened like the pages of a book, their mirrored veining creating a symmetrical pattern that can transform a wall into something resembling a painting. In practice, achieving a successful bookmatch requires careful planning, precise execution, and a deep understanding of how a particular stone's veining behaves across its depth.$str$,
    $str$Not every marble is equally suited to bookmatching. Stones with strong, directional veining — Calacatta Gold, Statuario, Fusion Black — produce the most visually arresting results, as the symmetry of their patterns becomes a bold architectural statement. Marbles with more diffuse, random patterning will produce a softer, less defined match that can be equally beautiful but requires different design handling. Before specifying a bookmatch, it is essential to view the consecutive slabs together, ideally standing them vertically as they will appear in the finished installation.$str$,
    $str$The practical requirements of a successful bookmatch begin at the quarry. Consecutive slabs must be kept together and tracked from the moment of extraction. At Trivedi Marbles, we number and photograph every slab in sequence so that consecutive pairs can be identified and reserved for projects requiring a match. This cataloguing process is fundamental — a bookmatch is only possible if the slabs have been stored and transported in a way that preserves both their sequence and their condition.$str$,
    $str$Installation demands the same rigour. The slabs must be dry-laid before fixing to confirm the match and resolve any adjustments. Joint widths should be minimised to maintain the continuity of the pattern — in the finest installations, the joint is barely perceptible, and the eye travels across the entire wall surface as a single composition. When light plays across a well-executed bookmatch over the course of a day, the result is an ever-changing work of art that no manufactured product can approach. It is one of the most compelling arguments for the irreplaceability of natural stone.$str$
  ],
  true
);
