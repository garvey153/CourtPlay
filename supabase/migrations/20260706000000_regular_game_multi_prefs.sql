-- Regular-game posts can now express multiple preferred play types, group sizes,
-- and skill levels. Add array columns for them. The legacy single columns
-- (format, total_players, skill_level) are still populated with the first
-- selected value so the feed card / filter keep working unchanged.
alter table public.posts
    add column if not exists pref_play_types text[],
    add column if not exists pref_group_sizes integer[],
    add column if not exists pref_skill_levels text[];
