<template>
  <div class="login-view">
    <n-card title="登录" style="width: 380px;">
      <n-form @submit.prevent="handleLogin">
        <n-form-item label="邮箱">
          <n-input v-model:value="email" placeholder="email@example.com" />
        </n-form-item>
        <n-form-item label="密码">
          <n-input
            v-model:value="password"
            type="password"
            show-password-on="click"
            @keyup.enter="handleLogin"
          />
        </n-form-item>
        <n-button type="primary" block :loading="auth.loading" @click="handleLogin">
          登录
        </n-button>
      </n-form>
      <p v-if="auth.error" class="error">{{ auth.error }}</p>
      <p class="hint">默认管理员：admin@example.com / admin123456</p>
      <p class="hint">注册账号后默认为 user 角色，editor/admin 由管理员分配。</p>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { NCard, NForm, NFormItem, NInput, NButton } from 'naive-ui';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const email = ref('admin@example.com');
const password = ref('admin123456');

async function handleLogin(): Promise<void> {
  try {
    await auth.login(email.value, password.value);
    const redirect = (route.query.redirect as string) || '/';
    router.push(redirect);
  } catch {
    /* error already in store */
  }
}
</script>

<style scoped>
.login-view {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: #f5f5f5;
}
.error {
  color: #c0392b;
  margin-top: 8px;
  font-size: 13px;
}
.hint {
  margin-top: 12px;
  color: #888;
  font-size: 12px;
}
</style>
