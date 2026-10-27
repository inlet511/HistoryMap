<template>
  <div class="admin-view">
    <header class="admin-header">
      <h2>管理后台</h2>
      <div class="actions">
        <span class="user">{{ auth.user?.username }} ({{ auth.role }})</span>
        <n-button size="small" @click="$router.push('/')">返回地图</n-button>
        <n-button size="small" quaternary @click="auth.logout().then(() => $router.push('/'))">退出</n-button>
      </div>
    </header>
    <n-layout has-sider class="admin-body">
      <n-layout-sider bordered :width="200" content-style="padding: 12px;">
        <n-menu :options="menuOptions" :value="activeTab" @update:value="(v) => activeTab = v" />
      </n-layout-sider>
      <n-layout-content content-style="padding: 24px;">
        <h3>{{ activeLabel }}</h3>
        <n-divider />
        <p class="placeholder">
          {{ activeTab }} 模块管理界面待实现。可通过 JSON/GeoJSON 批量导入，
          或在地图上直接绘制势力范围、点击选点添加事件、画连线添加战争路径。
        </p>
        <p class="placeholder">
          CRUD API 已就绪：<code>GET/POST/PUT/DELETE /api/v1/{{ activeTab }}</code>（editor+）
        </p>
      </n-layout-content>
    </n-layout>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  NLayout,
  NLayoutSider,
  NLayoutContent,
  NMenu,
  NButton,
  NDivider,
  type MenuOption,
} from 'naive-ui';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const activeTab = ref('dynasties');

const labels: Record<string, string> = {
  dynasties: '朝代管理',
  factions: '势力管理',
  events: '事件管理',
  wars: '战争管理',
  users: '用户管理',
};
const activeLabel = computed(() => labels[activeTab.value] ?? activeTab.value);

const menuOptions: MenuOption[] = [
  { label: '朝代', key: 'dynasties' },
  { label: '势力', key: 'factions' },
  { label: '事件', key: 'events' },
  { label: '战争', key: 'wars' },
  { label: '用户', key: 'users' },
];
</script>

<style scoped>
.admin-view {
  height: 100vh;
  display: flex;
  flex-direction: column;
}
.admin-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  border-bottom: 1px solid #eee;
  background: #fff;
}
.admin-header h2 {
  margin: 0;
  font-size: 18px;
}
.actions {
  display: flex;
  align-items: center;
  gap: 12px;
}
.user {
  color: #888;
  font-size: 13px;
}
.admin-body {
  flex: 1;
  min-height: 0;
}
.placeholder {
  color: #888;
  font-size: 13px;
  line-height: 1.8;
}
code {
  background: #f0f0f0;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 12px;
}
</style>
