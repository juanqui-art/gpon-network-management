/** True when a keyboard event originates from a text-entry element. */
export function isEditableTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	const tag = target.tagName.toLowerCase();
	return (
		target.isContentEditable ||
		tag === "input" ||
		tag === "textarea" ||
		tag === "select"
	);
}
