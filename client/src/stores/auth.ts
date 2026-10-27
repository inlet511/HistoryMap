import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { authApi } from '@/api/auth';
import { setToken, clearToken, getToken } from '@/api/client';
import type { User } from '@/types';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const initialized = ref(false);

  const isAuthenticated = computed(() => !!user.value);
  const role = computed(() => user.value?.role ?? 'reader');
  const isEditor = computed(() => ['editor', 'admin'].includes(role.value));
  const isAdmin = computed(() => role.value === 'admin');

  async function init(): Promise<void> {
    const token = getToken();
    if (!token) {
      initialized.value = true;
      return;
    }
    try {
      const res = await authApi.me();
      user.value = res.user;
    } catch {
      clearToken();
    } finally {
      initialized.value = true;
    }
  }

  async function login(email: string, password: string): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const res = await authApi.login({ email, password });
      setToken(res.accessToken);
      user.value = res.user;
    } catch (e) {
      error.value = (e as Error).message;
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function register(input: {
    email: string;
    username: string;
    password: string;
    displayName?: string;
  }): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const res = await authApi.register(input);
      setToken(res.accessToken);
      user.value = res.user;
    } catch (e) {
      error.value = (e as Error).message;
      throw e;
    } finally {
      loading.value = false;
    }
  }

  async function logout(): Promise<void> {
    try {
      await authApi.logout();
    } catch {
      /* ignore network errors on logout */
    }
    clear();
  }

  function clear(): void {
    user.value = null;
    clearToken();
  }

  return {
    user,
    loading,
    error,
    initialized,
    isAuthenticated,
    role,
    isEditor,
    isAdmin,
    init,
    login,
    register,
    logout,
    clear,
  };
});
