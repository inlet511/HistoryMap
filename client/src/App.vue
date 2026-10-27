<template>
  <n-config-provider :theme-overrides="themeOverrides" :locale="zhCN" :date-locale="dateZhCN">
    <n-message-provider>
      <n-dialog-provider>
        <n-notification-provider>
          <router-view />
        </n-notification-provider>
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useAuthStore } from '@/stores/auth';
import {
  NConfigProvider,
  NMessageProvider,
  NDialogProvider,
  NNotificationProvider,
  zhCN,
  dateZhCN,
  type GlobalThemeOverrides,
} from 'naive-ui';

const auth = useAuthStore();

const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#c0392b',
    primaryColorHover: '#d44536',
    primaryColorPressed: '#a93226',
    borderRadius: '6px',
  },
};

onMounted(() => {
  auth.init();
});
</script>
