import Aslmoviez from '../sources/aslmoviez.js'
import Cinamatic from '../sources/cinamatic.js'
import Digimovie from '../sources/digimovie.js'
import Animex from '../sources/animex.js'
import Donyayeserial from '../sources/donyayeserial.js'
import F2Media from '../sources/f2media.js'
import Peepboxtv from '../sources/peepboxtv.js'
import Serialblog from '../sources/serialblog.js'
import {
    isF2TurkishEnabled,
    f2turkishManifestCatalogs,
    f2turkishListCatalog,
    F2TURKISH_CATALOG_ID,
} from '../sources/f2turkish.js'
import {ID_SEPARATOR, METADATA_SOURCE} from '../sources/source.js'
import {findExternalMetaSource, findExternalStreamSource, formatStreamTitle, getExternalCatalogSources, getKitsuTitle, getTMDBMetaFa, getTMDBMetaByTmdbId, getTMDBDetails, getTMDBTitle, getLandingTmdbCatalogs, getTorrentStreams, modifyUrls, proxyExternalCatalog, proxyExternalMeta, proxyExternalStream, proxySubtitles, translateCatalogName, buildOrderedExternalCatalogs, classifyExternalCatalogSource, rewriteTmdbImageUrls, parseTmdbImageProxyPath, enrichMetaWithFaTmdb, enrichCatalogMetasWithoutRpdb, setMetaLangPref, setUiLangPref} from '../utils.js'
import {landingUrlsFromRequest, renderLandingPage, renderConfigurePage, renderGuidePage} from '../landing.js'
import {createFetchHttpClient} from './http-client.js'
import {createWorkerProxyConfig, handleProxyRequest} from './proxy.js'
import {decodeAddonConfig, mergeEnv} from './config.js'

const ADDON_PREFIX = 'ip'
const ADDON_VERSION = '3.0.0'

// NOTE: full worker body continues — this is a partial push failure marker
export function createWorkerHandler() {
  return async () => new Response('worker rebuild pending', {status: 503})
}
