/**
 * Form field surfaces, per the design system.
 *
 * These were duplicated as local constants across ten files under three
 * different names (FIELD, FIELD_WRAPPER, FIELD_INPUT), which is how the admin
 * court sheet ended up as the one screen with unstyled inputs — there was no
 * single thing to reach for. Import from here instead of redeclaring.
 *
 * Pass to the relevant slot on each component:
 *   <Input wrapperClassName={FIELD} />
 *   <TextArea textAreaClassName={FIELD} />
 *   <Select triggerClassName={FIELD_SELECT} />
 */

/** Text inputs and textareas: bg/tertiary fill with a border/tertiary outline. */
export const FIELD = "bg-tertiary ring-neutral-600";

/** Dropdown triggers: the same fill, no outline or shadow. */
export const FIELD_SELECT = "bg-tertiary ring-0 shadow-none";

/**
 * FIELD plus Chrome autofill overrides. Without these Chrome paints an
 * autofilled input white and highlights the related name field, which breaks
 * the dark surface. Only needed where the browser will actually offer to
 * autofill — name, phone, email — so it is opt-in rather than folded into
 * FIELD, which would emit the extra rules on every field in the app.
 */
export const FIELD_AUTOFILL =
    `${FIELD} [&_input:-webkit-autofill]:[-webkit-box-shadow:inset_0_0_0_1000px_var(--color-bg-tertiary)] [&_input:-webkit-autofill]:[-webkit-text-fill-color:var(--color-text-primary)]`;
