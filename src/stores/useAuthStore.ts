import { create } from 'zustand'

interface User {
    displayName: string | null,
    email: string | null,
    photoURL: string | null,
}

type AuthStore = {
   user: User | null,
   setUser: (user: User) => void,
}

const useAuthStore = create<AuthStore>()((set) => ({
    user: null,
    setUser: (user: User) => set({ user }),
}))

export default useAuthStore;