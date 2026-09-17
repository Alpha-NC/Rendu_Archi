'use client'

import { createAuthClient } from '@neondatabase/auth/next'

/** Client Neon Auth côté navigateur — appelle app/api/auth/[...path] (même origine). */
export const authClient = createAuthClient()
