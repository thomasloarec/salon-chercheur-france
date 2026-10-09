/** Jeton de requête : seul le dernier appel lancé et non annulé peut appliquer son résultat. */
export function createRequestGate() {
  let current = 0;
  return {
    next: () => ++current,
    cancel: () => { current++; },
    isCurrent: (token: number) => token === current,
  };
}
