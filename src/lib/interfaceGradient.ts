import type { Locale } from '../i18n'
export const gradients = ['aurora','ocean','sunset','forest','off'] as const
export type InterfaceGradient = typeof gradients[number]
const key = (userId:string) => `nexo_interface_gradient_${userId}`
export function readGradient(userId:string):InterfaceGradient {
 try { const v=localStorage.getItem(key(userId)); return gradients.includes(v as InterfaceGradient) ? v as InterfaceGradient : 'aurora' } catch { return 'aurora' }
}
export function applyGradient(value:InterfaceGradient) { document.documentElement.dataset.uiGradient=value }
export function saveGradient(userId:string,value:InterfaceGradient) { localStorage.setItem(key(userId),value); applyGradient(value) }
export const gradientText:Record<Locale,{title:string;hint:string;failed:string;search:string;notFound:string;names:Record<InterfaceGradient,string>}> = {
 en:{title:'Animated background',hint:'Saved on this device for your account.',failed:'Could not save on this device.',search:'Search chats',notFound:'No matching chats.',names:{aurora:'Aurora',ocean:'Ocean',sunset:'Sunset',forest:'Forest',off:'Off'}},
 ru:{title:'Переливающийся фон',hint:'Сохраняется на этом устройстве для твоего аккаунта.',failed:'Не удалось сохранить на этом устройстве.',search:'Поиск чатов',notFound:'Чаты не найдены.',names:{aurora:'Сияние',ocean:'Океан',sunset:'Закат',forest:'Лес',off:'Выключен'}},
 uk:{title:'Переливчастий фон',hint:'Зберігається на цьому пристрої для твого акаунта.',failed:'Не вдалося зберегти на цьому пристрої.',search:'Пошук чатів',notFound:'Чатів не знайдено.',names:{aurora:'Сяйво',ocean:'Океан',sunset:'Захід',forest:'Ліс',off:'Вимкнено'}},
 'zh-CN':{title:'流动渐变背景',hint:'为你的账号保存在此设备上。',failed:'无法保存在此设备上。',search:'搜索聊天',notFound:'未找到聊天。',names:{aurora:'极光',ocean:'海洋',sunset:'落日',forest:'森林',off:'关闭'}}
}
