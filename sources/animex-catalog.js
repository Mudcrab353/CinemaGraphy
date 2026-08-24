/**
 * temp - will replace
 */
export const ANIMEX_CATALOG_ID = 'animex_anime_catalog'
export const ANIMEX_CATALOG_NAME_FA = 'انیمکس'
export const ANIMEX_CATALOG_NAME_EN = 'animex'
export function isAnimexCatalogEnabled(env={}){return true}
export function animexCatalogDisplayName(lang='fa'){return String(lang).startsWith('en')?'animex':'انیمکس'}
export function animexCatalogManifestCatalogs(env,lang='fa'){return[{type:'series',id:ANIMEX_CATALOG_ID,name:animexCatalogDisplayName(lang),extra:[{name:'search',isRequired:false},{name:'skip',isRequired:false}]}]}
export async function animexCatalogList(){return{metas:[]}}
