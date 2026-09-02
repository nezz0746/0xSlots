"use client";

// The React surface, now the live protocol's.
//
// This re-exported a V1 `useSlotAction` built on the retired GraphQL client,
// while `/slots/react` exported a DIFFERENT hook of the same name for the live
// protocol. Importing the wrong one type-checked and failed at runtime.
export * from "./slots/react";
