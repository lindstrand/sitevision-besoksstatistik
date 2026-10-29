import router from '@sitevision/api/common/router';
import appData from '@sitevision/api/server/appData';
import globalAppData from '@sitevision/api/server/globalAppData';
import logUtil from '@sitevision/api/server/LogUtil';
import portletContextUtil from '@sitevision/api/server/PortletContextUtil';
import properties from '@sitevision/api/server/Properties';
import resourceLocatorUtil from '@sitevision/api/server/ResourceLocatorUtil';
import onlineVersionPropertyUtil from '@sitevision/api/server/OnlineVersionPropertyUtil';
import nodeFilterUtil from '@sitevision/api/server/NodeFilterUtil';
import nodeIteratorUtil from '@sitevision/api/server/NodeIteratorUtil';
import restAppInvokerFactory from '@sitevision/api/server/RestAppInvokerFactory';

const APP_VERSION = '1.9.0';
const LOG_PREFIX = `[Besöksstatistik ${APP_VERSION}]`;

const API = {
  appData,
  globalAppData,
  PortletContextUtil: portletContextUtil,
  Properties: properties,
  ResourceLocatorUtil: resourceLocatorUtil,
  OnlineVersionPropertyUtil: onlineVersionPropertyUtil,
  NodeFilterUtil: nodeFilterUtil,
  NodeIteratorUtil: nodeIteratorUtil,
  RestAppInvokerFactory: restAppInvokerFactory,
};

function safeLogDetail(error) {
  if (!error) return '';
  var name = String(error.name || '').replace(/[^A-Za-z0-9_.-]/g, '').substring(0, 80);
  var code = String(error.code || '').replace(/[^A-Za-z0-9_.-]/g, '').substring(0, 80);
  if (name && code) return name + ':' + code;
  return name || code || 'Error';
}

function logError(message, error) {
  try {
    if (!logUtil.isErrorEnabled()) return;
    var detail = safeLogDetail(error);
    logUtil.error(LOG_PREFIX + ' ' + message + (detail ? ' detail=' + detail : ''));
  } catch (ignore) {}
}

function logWarn(message) {
  try { if (logUtil.isWarnEnabled()) logUtil.warn(LOG_PREFIX + ' ' + message); } catch (ignore) {}
}

function logDebug(message) {
  try { if (logUtil.isDebugEnabled()) logUtil.debug(LOG_PREFIX + ' ' + message); } catch (ignore) {}
}

  'use strict';
  /**
   * Besöksstatistik för Sitevision Dashboard.
   *
   * Datakälla: webbplatsens centralt konfigurerade Piwik PRO-integration via
   * sv-piwik-pro-backend och RestAppInvokerFactory. Widgeten innehåller inga
   * egna Piwik-autentiseringsuppgifter.
   *
   * Root-routen gör inga Piwik-anrop. Jag vill att redaktören ska få en synlig
   * laddningsstatus direkt, därför hämtar klienten själva statistiken från den
   * fristående routen /statistics.
   *
   * Grenstatistik använder Sitevision-ID:n för samtliga publicerade sidor i grenen.
   * Det gör att historisk trafik följer sidan även om dess URL har ändrats.
   *
   * Utvecklare: Magnus Lindstrand, Hässleholms kommun
   * Version: 1.9.0
   */
  var BACKEND='/rest-api/sv-piwik-pro-backend';
  var QUERY_ROUTE='/ai-tool/query'; // Endpointnamn tillhandahållet av Sitevision.
  var PAGE_ID_DIM='event_custom_dimension_1';
  function validPageIdDimension(v){
    var x=String(v||'').replace(/^\s+|\s+$/g,'');
    return /^event_custom_dimension_[1-9][0-9]*$/.test(x)?x:'event_custom_dimension_1';
  }
  var MAX_BRANCH_IDS=600;

  // Tekniska URL-varianter som inte ska räknas som redaktionellt innehåll.
  // Standardreglerna kan ändras i Globala inställningar och kompletteras med
  // egna mönster. Ingen kundspecifik domän eller sökväg är hårdkodad.
  var excludeSettings={printable:true,queryString:true,inloggad:true,systemParts:true,customPatterns:[],queryExceptions:[]};
  function parsePatterns(v){
    var rows=String(v||'').split(/\r?\n/),out=[];
    for(var i=0;i<rows.length;i++){var x=rows[i].replace(/^\s+|\s+$/g,'').toLowerCase();if(x)out.push(x);}
    return out;
  }
  function parseParamNames(v){
    var raw=String(v||'').split(/[;,\s]+/),out=[],seen={};
    for(var i=0;i<raw.length;i++){
      var x=raw[i].replace(/^\s+|\s+$/g,'').toLowerCase();
      if(x&&/^[a-z0-9_.-]+$/.test(x)&&!seen[x]){seen[x]=1;out.push(x);}
    }
    return out;
  }
  function loadQueryExceptions(store){
    var out=[];
    for(var i=1;i<=8;i++){
      var page=String(get(store,'queryExceptionPage'+i,'')||'');
      var params=parseParamNames(get(store,'queryExceptionParams'+i,''));
      if(page&&params.length)out.push({pageId:page,params:params});
    }
    return out;
  }
  function queryExceptionForPage(id){
    if(!excludeSettings.queryString)return null;
    var wanted=String(id||'');
    for(var i=0;i<excludeSettings.queryExceptions.length;i++)if(excludeSettings.queryExceptions[i].pageId===wanted)return excludeSettings.queryExceptions[i];
    return null;
  }
  function urlHasAllowedQuery(url,exception){
    if(!exception)return false;
    var raw=String(url||''),q=raw.indexOf('?');if(q<0)return false;
    var query=raw.substring(q+1).split('#')[0].split('&');
    for(var i=0;i<query.length;i++){
      var name=String(query[i].split('=')[0]||'').toLowerCase();
      try{name=decodeURIComponent(name);}catch(ignore){}
      for(var j=0;j<exception.params.length;j++)if(name===exception.params[j])return true;
    }
    return false;
  }
  function canonicalExceptionUrl(url,exception){
    var raw=String(url||''),q=raw.indexOf('?');if(q<0||!exception)return raw.split('#')[0];
    var base=raw.substring(0,q),parts=raw.substring(q+1).split('#')[0].split('&'),kept=[];
    for(var i=0;i<parts.length;i++){
      var bit=parts[i],name=String(bit.split('=')[0]||'').toLowerCase();
      try{name=decodeURIComponent(name);}catch(ignore){}
      for(var j=0;j<exception.params.length;j++)if(name===exception.params[j]){kept.push(bit);break;}
    }
    kept.sort();return base+(kept.length?'?'+kept.join('&'):'');
  }
  function exceptionLabel(title,fallback,url,exception){
    var t=String(title||'').replace(/^\s+|\s+$/g,'');
    if(t&&t.toLowerCase()!=='okänt')return t;
    var bits=[],canon=canonicalExceptionUrl(url,exception),q=canon.indexOf('?');
    if(q>=0){var p=canon.substring(q+1).split('&');for(var i=0;i<p.length;i++){var kv=p[i].split('=');if(kv[1])bits.push(decodeURIComponent(kv[1]));}}
    return String(fallback||'Innehåll')+(bits.length?' – '+bits.join(', '):'');
  }
  function hasSystemSegment(url){
    var u=String(url||'').toLowerCase().replace(/^https?:\/\/[^\/]+/i,'').split('?')[0];
    var parts=u.split('/');
    for(var i=0;i<parts.length;i++){
      var part=parts[i];
      if(part==='system'||part.indexOf('system--')===0)return true;
    }
    return false;
  }
  function exclusionReason(url){
    var raw=String(url||''),u=raw.toLowerCase();
    if(!u)return 'tom';
    if(excludeSettings.printable&&u.indexOf('.printable')>=0)return 'printable';
    if(excludeSettings.queryString&&u.indexOf('?')>=0)return 'query';
    if(excludeSettings.inloggad&&u.indexOf('inloggad')>=0)return 'inloggad';
    if(excludeSettings.systemParts&&hasSystemSegment(u))return 'system';
    for(var i=0;i<excludeSettings.customPatterns.length;i++)if(u.indexOf(excludeSettings.customPatterns[i])>=0)return 'eget';
    return '';
  }
  function isIncludedUrl(url){return !exclusionReason(url);}

  function getSiteContext(){
    var rl=safeRequire('ResourceLocatorUtil'), op=safeRequire('OnlineVersionPropertyUtil');
    var r={ok:false,sitePage:null,siteId:'',siteName:'',siteUrl:'',origin:'',error:''};
    if(!rl.ok||!rl.value||!rl.value.getSitePage){r.error='Kunde inte identifiera aktuell Sitevision-webbplats.';return r;}
    try{
      var sitePage=rl.value.getSitePage();
      if(!sitePage){r.error='Webbplatsens startsida kunde inte hittas.';return r;}
      r.sitePage=sitePage;r.siteId=pageId(sitePage);
      try{r.siteName=String(sitePage.getName?sitePage.getName():'');}catch(ignore){}
      if(op.ok&&op.value&&op.value.getString&&r.siteId){
        try{r.siteUrl=String(op.value.getString(r.siteId,'URL','')||'');}catch(ignore2){}
      }
      if(r.siteUrl){
        var m=r.siteUrl.match(/^(https?:\/\/[^\/]+)/i);
        if(m)r.origin=m[1];
      }
      r.ok=true;return r;
    }catch(e){r.error=String(e);return r;}
  }

  function safeRequire(name){
    var value=API[name];
    return value?{ok:true,value:value,error:''}:{ok:false,value:null,error:'Sitevision API saknas: '+String(name||'')};
  }
  function get(store,key,fallback){try{var v=store&&store.get?store.get(key):null;return v===null||typeof v==='undefined'||v===''?fallback:v;}catch(e){return fallback;}}
  function configured(req,store,key,fallback){
    var param='svcfg_'+key;
    try{
      if(req&&req.params&&Object.prototype.hasOwnProperty.call(req.params,param)){
        var pv=req.params[param];
        if(pv!==null&&typeof pv!=='undefined'&&pv!=='')return pv;
      }
    }catch(ignore){}
    return get(store,key,fallback);
  }
  function localConfigQuery(store){
    var keys=['defaultScope','defaultPeriod','initialRows','moreRows','showTopLists','showZeroViews','showDevices','showCountries','showInsights','showDownloads','showOutlinks','showCampaigns','showAiTraffic'];
    var defaults={defaultScope:'branch',defaultPeriod:'7',initialRows:'5',moreRows:'10',showTopLists:true,showZeroViews:true,showDevices:true,showCountries:true,showInsights:true,showDownloads:true,showOutlinks:true,showCampaigns:true,showAiTraffic:true};
    var parts=[];
    for(var i=0;i<keys.length;i++){
      var key=keys[i],value=get(store,key,defaults[key]);
      parts.push(encodeURIComponent('svcfg_'+key)+'='+encodeURIComponent(String(value)));
    }
    return parts.join('&');
  }
  function esc(v){return String(v===null||typeof v==='undefined'?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
  function num(v){var n=Number(v||0);return isFinite(n)?n:0;}
  function fmt(v){return String(Math.round(num(v))).replace(/\B(?=(\d{3})+(?!\d))/g,' ');}
  function bool(v,d){if(v===null||typeof v==='undefined'||v==='')return d;return !(v===false||String(v).toLowerCase()==='false');}
  function primaryType(node){try{return String(node.getPrimaryNodeType().getName());}catch(e){return '';}}
  function isPublished(v){return !(v===false||String(v).toLowerCase()==='false');}
  function pageId(node){try{var id=String(node.getIdentifier()||'');return id.indexOf('_')>0?id.split('_')[0]:id;}catch(e){return '';}}

  function getCurrentPage(){
    var c=safeRequire('PortletContextUtil'), p=safeRequire('Properties');
    if(!c.ok||!c.value||!c.value.getCurrentPage)return {ok:false,error:'Kunde inte läsa aktuell sida.'};
    try{
      var node=c.value.getCurrentPage(); if(!node)return {ok:false,error:'Aktuell sida saknas.'};
      var name=''; if(p.ok&&p.value&&p.value.get){try{name=String(p.value.get(node,'displayName')||'');}catch(ignore){}}
      return {ok:true,node:node,id:pageId(node),name:name,type:primaryType(node)};
    }catch(e){return {ok:false,error:String(e)};}
  }

  function collectBranch(startNode){
    var nf=safeRequire('NodeFilterUtil'), ni=safeRequire('NodeIteratorUtil'), pr=safeRequire('Properties'), op=safeRequire('OnlineVersionPropertyUtil');
    var r={ok:false,pages:[],visited:0,truncated:false,error:''};
    if(!nf.ok||!ni.ok||!pr.ok){r.error='Sitevisions nodverktyg kunde inte laddas.';return r;}
    var traversal=['sv:sitePage','sv:page','sv:structurePage','sv:article','sv:folder','sv:archive'];
    var content={'sv:sitePage':1,'sv:page':1,'sv:structurePage':1,'sv:article':1};
    var map={};for(var i=0;i<traversal.length;i++)map[traversal[i]]=1;
    var filter;try{filter=nf.value.getAnyOfPrimaryNodeTypesFilter(traversal);}catch(e){r.error=String(e);return r;}
    function visit(node,depth){
      if(!node||r.truncated)return; if(depth>30||r.visited>=5000){r.truncated=true;return;} r.visited++;
      var t=primaryType(node);
      if(content[t]){
        try{
          var props=pr.value.get(node,'displayName','published'); var id=pageId(node); var online='';
          if(id&&op.ok&&op.value&&op.value.getString)online=String(op.value.getString(id,'URL','')||'');
          if(id&&online&&isPublished(props&&props.published)&&isIncludedUrl(online))r.pages.push({id:id,name:String((props&&props.displayName)||id),url:online});
        }catch(ignore){}
      }
      if(!map[t])return;
      try{var it=ni.value.getFilteredNodeIterator(node.getNodes(),filter);while(it&&it.hasNext())visit(it.nextNode(),depth+1);}catch(ignore2){}
    }
    visit(startNode,0); r.ok=true; return r;
  }

  // Kontrollera om aktuell sida faktiskt har någon publicerad undersida som kan ingå i grenstatistik.
  // Används för att dölja grenvalet på blad-sidor, så att redaktören kommer direkt till sidstatistiken.
  function hasPublishedDescendant(startNode){
    var nf=safeRequire('NodeFilterUtil'),ni=safeRequire('NodeIteratorUtil'),pr=safeRequire('Properties'),op=safeRequire('OnlineVersionPropertyUtil');
    if(!startNode||!nf.ok||!ni.ok||!pr.ok)return true; // Hellre visa grenval än dölja det vid tekniskt fel.
    var traversal=['sv:sitePage','sv:page','sv:structurePage','sv:article','sv:folder','sv:archive'];
    var content={'sv:sitePage':1,'sv:page':1,'sv:structurePage':1,'sv:article':1},map={};
    for(var i=0;i<traversal.length;i++)map[traversal[i]]=1;
    var filter;try{filter=nf.value.getAnyOfPrimaryNodeTypesFilter(traversal);}catch(e){return true;}
    var visited=0;
    function walk(node,depth){
      if(!node||depth>20||visited>1000)return false;visited++;
      var t=primaryType(node);
      if(content[t]){
        try{
          var props=pr.value.get(node,'published'),id=pageId(node),online='';
          if(id&&op.ok&&op.value&&op.value.getString)online=String(op.value.getString(id,'URL','')||'');
          if(id&&online&&isPublished(props&&props.published)&&isIncludedUrl(online))return true;
        }catch(ignore){}
      }
      if(!map[t])return false;
      try{var it=ni.value.getFilteredNodeIterator(node.getNodes(),filter);while(it&&it.hasNext())if(walk(it.nextNode(),depth+1))return true;}catch(ignore2){}
      return false;
    }
    try{var it=ni.value.getFilteredNodeIterator(startNode.getNodes(),filter);while(it&&it.hasNext())if(walk(it.nextNode(),1))return true;}catch(ignore3){return true;}
    return false;
  }

  function eventFilter(extra){
    var conditions=[{column_id:'event_type',condition:{operator:'eq',value:1}}];
    if(extra)conditions.push(extra);
    return {operator:'and',conditions:conditions};
  }
  function queryExceptionCondition(exceptions){
    var ors=[{column_id:'event_url',condition:{operator:'not_contains',value:'?'}}];
    var xs=exceptions||excludeSettings.queryExceptions;
    for(var i=0;i<xs.length;i++){
      var ex=xs[i],paramOr=[];
      for(var j=0;j<ex.params.length;j++){
        paramOr.push({column_id:'event_url',condition:{operator:'contains',value:'?'+ex.params[j]+'='}});
        paramOr.push({column_id:'event_url',condition:{operator:'contains',value:'&'+ex.params[j]+'='}});
      }
      if(paramOr.length)ors.push({operator:'and',conditions:[
        {column_id:PAGE_ID_DIM,condition:{operator:'eq',value:ex.pageId}},
        {operator:'or',conditions:paramOr}
      ]});
    }
    return {operator:'or',conditions:ors};
  }
  function addUrlExclusions(conditions,queryExceptions){
    if(excludeSettings.printable)conditions.push({column_id:'event_url',condition:{operator:'not_contains',value:'.printable'}});
    if(excludeSettings.queryString)conditions.push(queryExceptionCondition(queryExceptions));
    if(excludeSettings.inloggad)conditions.push({column_id:'event_url',condition:{operator:'not_icontains',value:'inloggad'}});
    if(excludeSettings.systemParts){
      conditions.push({column_id:'event_url',condition:{operator:'not_contains',value:'/system/'}});
      conditions.push({column_id:'event_url',condition:{operator:'not_contains',value:'/system--'}});
    }
    for(var i=0;i<excludeSettings.customPatterns.length;i++)conditions.push({column_id:'event_url',condition:{operator:'not_icontains',value:excludeSettings.customPatterns[i]}});
  }
  // Bygg ett kompakt filter för en Sitevision-gren utifrån sidornas ID:n.
  // ID:n följer Sitevision-trädet även när publicerade URL:er inte gör det,
  // vilket är viktigt på exempelvis intranät där navigationshierarki och URL-struktur kan skilja sig.
  // Ett stort OR-träd med ett eq-villkor per sida kan ge HTTP 400 i Piwik.
  // Därför matchar vi hela ID-listan i ett enda exakt regexvillkor.
  function regexEscape(value){
    return String(value||'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  }
  function idListCondition(ids){
    if(!ids||!ids.length)return null;
    if(ids.length===1)return {column_id:PAGE_ID_DIM,condition:{operator:'eq',value:ids[0]}};
    var escaped=[];
    for(var i=0;i<ids.length;i++)escaped.push(regexEscape(ids[i]));
    return {column_id:PAGE_ID_DIM,condition:{operator:'matches',value:'^(?:'+escaped.join('|')+')$'}};
  }
  function branchFilter(ids){
    if(!ids||!ids.length)return eventFilter(null);
    return eventFilter(idListCondition(ids));
  }
  function branchIdFilter(ids){
    var f=branchFilter(ids);
    addUrlExclusions(f.conditions);
    return f;
  }
  function pageContentFilter(id){
    var f=branchFilter([id]);
    addUrlExclusions(f.conditions);
    return f;
  }

  function siteUrlFilter(origin){
    var conditions=[{column_id:'event_type',condition:{operator:'eq',value:1}}];
    if(origin)conditions.push({column_id:'event_url',condition:{operator:'starts_with',value:origin}});
    // Samma regler används mot Piwik som mot Sitevisions sidträd.
    addUrlExclusions(conditions);
    return {operator:'and',conditions:conditions};
  }


  function urlOrQueryFilter(columnId,baseUrl){
    var base=String(baseUrl||'').split('?')[0].replace(/\/+$/,'');
    return {operator:'or',conditions:[
      {column_id:columnId,condition:{operator:'eq',value:base}},
      {column_id:columnId,condition:{operator:'starts_with',value:base+'?'}}
    ]};
  }

  // Filter för händelser som inte är sidvisningar, till exempel nedladdningar.
  // event_url är sidan där händelsen skedde.
  function pageEventFilter(pageUrl){
    var conditions=[];
    if(pageUrl)conditions.push({column_id:'event_url',condition:{operator:'eq',value:pageUrl}});
    addUrlExclusions(conditions);
    return {operator:'and',conditions:conditions};
  }
  function branchEventFilter(ids){
    if(!ids||!ids.length)return {operator:'and',conditions:[]};
    var content=idListCondition(ids);
    var conditions=[content];
    addUrlExclusions(conditions);
    return {operator:'and',conditions:conditions};
  }
  function siteEventFilter(origin){
    var conditions=[];
    if(origin)conditions.push({column_id:'event_url',condition:{operator:'starts_with',value:origin}});
    addUrlExclusions(conditions);
    return {operator:'and',conditions:conditions};
  }

  function exceptionOnlyFilter(exceptions){
    var xs=exceptions||[],or=[];
    for(var i=0;i<xs.length;i++){
      var ex=xs[i],po=[];
      for(var j=0;j<ex.params.length;j++){
        po.push({column_id:'event_url',condition:{operator:'contains',value:'?'+ex.params[j]+'='}});
        po.push({column_id:'event_url',condition:{operator:'contains',value:'&'+ex.params[j]+'='}});
      }
      if(po.length)or.push({operator:'and',conditions:[{column_id:PAGE_ID_DIM,condition:{operator:'eq',value:ex.pageId}},{operator:'or',conditions:po}]});
    }
    if(!or.length)return null;
    var c=[{column_id:'event_type',condition:{operator:'eq',value:1}},or.length===1?or[0]:{operator:'or',conditions:or}];
    if(excludeSettings.printable)c.push({column_id:'event_url',condition:{operator:'not_contains',value:'.printable'}});
    if(excludeSettings.inloggad)c.push({column_id:'event_url',condition:{operator:'not_icontains',value:'inloggad'}});
    if(excludeSettings.systemParts){c.push({column_id:'event_url',condition:{operator:'not_contains',value:'/system/'}});c.push({column_id:'event_url',condition:{operator:'not_contains',value:'/system--'}});}
    for(var k=0;k<excludeSettings.customPatterns.length;k++)c.push({column_id:'event_url',condition:{operator:'not_icontains',value:excludeSettings.customPatterns[k]}});
    return {operator:'and',conditions:c};
  }
  function exceptionVariants(result,names){
    if(!result||!result.ok)return [];
    var rs=rows(result),map={};
    for(var i=0;i<rs.length;i++){
      var r=rs[i],id=String(r[PAGE_ID_DIM]||r[PAGE_ID_DIM+'__label']||''),ex=queryExceptionForPage(id);if(!ex)continue;
      var u=String(r.event_url__label||r.event_url||'');if(!urlHasAllowedQuery(u,ex))continue;
      var canon=canonicalExceptionUrl(u,ex),key=id+'|'+canon,title=String(r.event_title__label||r.event_title||'');
      if(!map[key])map[key]={id:id,name:exceptionLabel(title,names&&names[id],canon,ex),url:canon,views:0,sessions:0,visitors:0,queryVariant:true};
      map[key].views+=num(r.page_views);map[key].sessions+=num(r.sessions);map[key].visitors+=num(r.visitors);
      if(title&&title.toLowerCase()!=='okänt')map[key].name=title;
    }
    var out=[],nameCount={};for(var k in map)if(Object.prototype.hasOwnProperty.call(map,k)){out.push(map[k]);var nk=String(map[k].name||'').toLowerCase();nameCount[nk]=(nameCount[nk]||0)+1;}
    for(var oi=0;oi<out.length;oi++){
      var nk2=String(out[oi].name||'').toLowerCase();
      if(nameCount[nk2]>1){var ex2=queryExceptionForPage(out[oi].id),canon2=canonicalExceptionUrl(out[oi].url,ex2),q2=canon2.indexOf('?'),vals=[];if(q2>=0){var qp=canon2.substring(q2+1).split('&');for(var qi=0;qi<qp.length;qi++){var kv2=qp[qi].split('=');if(kv2[1]){try{vals.push(decodeURIComponent(kv2[1]));}catch(ignore){vals.push(kv2[1]);}}}}if(vals.length)out[oi].name+=' – '+vals.join(', ');}
    }
    out.sort(function(a,b){return b.sessions-a.sessions||b.views-a.views;});return out;
  }
  function dateSpec(req,defaultPeriod){
    var p=String((req&&req.params&&req.params.svstat_period)||defaultPeriod||'7');
    if(/^(7|30|90|365)$/.test(p))return {mode:p,label:'Senaste '+p+' avslutade dagarna',query:{relative_date:'last_'+p+'_days'}};
    if(p==='today')return {mode:p,label:'Idag',query:{relative_date:'today'}};
    var now=new Date();
    if(p==='previousYear'){
      var y=now.getFullYear()-1;return {mode:p,label:'Förra året · '+y,query:{date_from:y+'-01-01',date_to:y+'-12-31'}};
    }
    var f=req&&req.params?String(req.params.svstat_from||''):''; var t=req&&req.params?String(req.params.svstat_to||''):'';
    if(p==='custom'&&/^\d{4}-\d{2}-\d{2}$/.test(f)&&/^\d{4}-\d{2}-\d{2}$/.test(t))return {mode:p,label:f+' – '+t,from:f,to:t,query:{date_from:f,date_to:t}};
    return {mode:'7',label:'Senaste 7 avslutade dagarna',query:{relative_date:'last_7_days'}};
  }

  function query(restApp,date,filter,columns,limit,orderBy){
    var start=Date.now(); var q={offset:0,limit:limit,columns:columns,order_by:orderBy||[],filters:filter,metric_filters:null,format:'json-kv'};
    for(var k in date.query)if(Object.prototype.hasOwnProperty.call(date.query,k))q[k]=date.query[k];
    try{
      var x=restApp.post(QUERY_ROUTE,{queryData:q}); var code=x&&x.statusCode?Number(x.statusCode):0,ms=Date.now()-start,ok=code===200&&!!x.body;
      if(!ok)logWarn('Piwik-backendanrop misslyckades. http='+code+' tid='+ms+' ms.');
      return {ok:ok,ms:ms,statusCode:code,statusMessage:x&&x.statusMessage?String(x.statusMessage):'',body:x?x.body:null,error:code===200?'':'HTTP '+code};
    }catch(e){
      var ms=Date.now()-start,detail=safeLogDetail(e);
      logWarn('Piwik-backendanrop gav exception. typ='+(detail||'Error')+' tid='+ms+' ms.');
      return {ok:false,ms:ms,statusCode:0,statusMessage:'',body:null,error:String(e)};
    }
  }
  // Hitta den publika origin som Piwik faktiskt har registrerad för aktuell site.
  // Detta behövs i utvecklingsmiljöer där Sitevisions egen publika URL skiljer
  // sig från den produktionsdomän som statistiken gäller. Vi använder startsidans
  // Sitevision-ID, som följer med i event_custom_dimension_1, och låter Piwik
  // berätta vilken event_url som hör till sidan. Ingen domän hårdkodas.
  function discoverPiwikOrigin(restApp,date,sitePageId){
    if(!sitePageId)return {ok:false,origin:'',ms:0,statusCode:0,error:'Startsidan saknar Sitevision-ID.'};
    var f=branchFilter([sitePageId]);
    var r=query(restApp,date,f,[{column_id:'event_url'},{column_id:'page_views'}],20,[[1,'desc']]);
    if(!r.ok)return {ok:false,origin:'',ms:r.ms,statusCode:r.statusCode,error:r.error};
    var rr=rows(r),best='';
    for(var i=0;i<rr.length;i++){
      var u=String(rr[i].event_url__label||rr[i].event_url||'');
      var m=u.match(/^(https?:\/\/[^\/]+)/i);
      if(m&&isIncludedUrl(u)){best=m[1];break;}
    }
    return {ok:!!best,origin:best,ms:r.ms,statusCode:r.statusCode,error:best?'':'Piwik returnerade ingen användbar URL för webbplatsens startsida.'};
  }

  function bodyObj(result){var b=result&&result.body;if(typeof b==='string'){try{b=JSON.parse(b);}catch(ignore){}}return b||{};}
  function rows(result){var b=bodyObj(result);return Array.isArray(b.data)?b.data:[];}
  function first(result){var r=rows(result);return r.length?r[0]:{};}
  function label(row,key){return row[key+'__label']||row[key]||'Okänt';}

  function swCountry(v){var m={Sweden:'Sverige',Germany:'Tyskland',Denmark:'Danmark',Norway:'Norge',Finland:'Finland','United States':'USA','United Kingdom':'Storbritannien',Netherlands:'Nederländerna',France:'Frankrike',Poland:'Polen',Spain:'Spanien'};return m[v]||v;}
  function pct(v,total){return total?Math.round(num(v)*1000/total)/10:0;}
  function breakdown(result,key,metric){metric=metric||'page_views';var rs=rows(result),out=[],total=0;for(var i=0;i<rs.length;i++){var v=num(rs[i][metric]);out.push({label:String(label(rs[i],key)),value:v});total+=v;}out.sort(function(a,b){return b.value-a.value;});return {items:out,total:total,metric:metric};}

  function breakdownItemByLabel(b,labelValue){if(!b||!b.items)return null;var wanted=String(labelValue||'').toLowerCase();for(var i=0;i<b.items.length;i++)if(String(b.items[i].label||'').toLowerCase()===wanted)return b.items[i];return null;}
  function dominantBreakdownLabel(b){return b&&b.items&&b.items.length?String(b.items[0].label||''):'';}
  function mobileShare(b){if(!b||!b.total)return 0;var mobile=0;for(var i=0;i<b.items.length;i++){var l=String(b.items[i].label||'').toLowerCase();if(l.indexOf('mobile')>=0||l.indexOf('smartphone')>=0||l.indexOf('phone')>=0)mobile+=num(b.items[i].value);}return mobile*100/b.total;}
  function sourceName(labelValue){
    var l=String(labelValue||'').toLowerCase();
    if(l.indexOf('google')>=0)return 'Google';
    if(l.indexOf('direct')>=0||l.indexOf('direkt')>=0)return 'direkttrafik';
    if(l.indexOf('internal')>=0||l.indexOf('intern')>=0)return 'intern trafik';
    return '';
  }
  function addCountryInsight(c,localCountries,siteCountries,minScore){
    if(!localCountries||localCountries.total<100||!siteCountries||siteCountries.total<500)return;
    var home=dominantBreakdownLabel(siteCountries);
    for(var i=0;i<localCountries.items.length;i++){
      var it=localCountries.items[i],lab=String(it.label||'');
      if(!lab||lab==='Okänt'||lab.toLowerCase()===String(home).toLowerCase()||num(it.value)<30)continue;
      var si=breakdownItemByLabel(siteCountries,lab),local=pct(it.value,localCountries.total),sp=si?pct(si.value,siteCountries.total):0;
      var diff=Math.round((local-sp)*10)/10,ratio=sp>0?local/sp:(local>=4?99:0);
      if(local>=4&&diff>=3&&ratio>=1.8){
        var cn=swCountry(lab);
        c.push({score:(minScore||110)+diff,title:'Fler besök från '+cn+' än vanligt',text:String(local).replace('.',',')+' % av besöken är registrerade från '+cn+', jämfört med '+String(sp).replace('.',',')+' % på webbplatsen som helhet. Platsuppgiften är en uppskattning baserad på IP-adressen.'});
      }
    }
  }

  function periodDays(d){
    if(!d)return 7;
    if(d.mode==='today')return 1;
    if(d.mode==='7'||d.mode==='30'||d.mode==='90'||d.mode==='365')return Number(d.mode);
    if(d.mode==='previousYear')return 365;
    if(d.mode==='custom'&&d.from&&d.to){
      var a=new Date(d.from+'T00:00:00'),b=new Date(d.to+'T00:00:00');
      if(isFinite(a.getTime())&&isFinite(b.getTime()))return Math.max(1,Math.round((b-a)/86400000)+1);
    }
    return 7;
  }
  function visitsPerWeek(sessions,d){return num(sessions)*7/Math.max(1,periodDays(d));}

  // Ett ovanligt trafikmönster är en signal om datakvalitet, inte ett bevis på botar
  // och definitivt inte ett tecken på en attack. I grenöversikten säger vi därför bara
  // att automatiserade tjänster kan påverka statistiken. Den mer konkreta bedömningen
  // görs först när redaktören tittar på en enskild sida.
  function countryTrafficQualityInsight(countryResult,totalSessions,totalViews){
    if(!countryResult||!countryResult.ok||num(totalSessions)<=0)return null;
    var rs=rows(countryResult),allSessions=num(totalSessions),allViews=num(totalViews),normalPer=allSessions?allViews/allSessions:0;
    for(var i=0;i<rs.length;i++){
      var r=rs[i],sessions=num(r.sessions),views=num(r.page_views),country=swCountry(label(r,'location_country_name'));
      if(!country||country==='Okänt'||sessions<10)continue;
      var per=sessions?views/sessions:0,sessionShare=sessions*100/allSessions;
      // På grennivå varnar vi bara när mönstret både är mycket avvikande och stort nog
      // för att faktiskt kunna påverka statistiken. Några få konstiga besök ska inte
      // göra redaktören osäker på hela underlaget.
      if(sessionShare>=5&&per>=Math.max(10,normalPer*4)){
        return {score:145+sessionShare,title:'En del av trafiken har ett ovanligt mönster',text:'Cirka '+String(Math.round(sessionShare*10)/10).replace('.',',')+' % av besöken är registrerade från '+country+' och trafiken har ett tydligt avvikande besöksmönster. Det kan bero på crawlers eller andra automatiska tjänster och kan påverka statistiken märkbart.'};
      }
    }
    return null;
  }

  function pageTrafficQualityInsight(countryResult,siteCountries,totalSessions,d){
    if(!countryResult||!countryResult.ok||!siteCountries||!siteCountries.total||num(totalSessions)<=0)return null;
    // Sidnivån ska bara ge ett tydligare besked när sidan faktiskt har låg trafik.
    // Några automatiserade besök spelar liten roll på en välbesökt sida men kan helt
    // förändra tolkningen av en sida som nästan ingen människa verkar använda.
    if(visitsPerWeek(totalSessions,d)>2)return null;
    var home=dominantBreakdownLabel(siteCountries);
    if(!home)return null;
    var siteHome=breakdownItemByLabel(siteCountries,home),pageRows=rows(countryResult),pageHomeSessions=0,foreignSessions=0,totalCountrySessions=0,strongOutlier=false;
    for(var i=0;i<pageRows.length;i++){
      var r=pageRows[i],sessions=num(r.sessions),views=num(r.page_views),lab=String(label(r,'location_country_name')||'');
      totalCountrySessions+=sessions;
      if(lab.toLowerCase()===String(home).toLowerCase())pageHomeSessions+=sessions;else foreignSessions+=sessions;
      if(sessions>=1&&views/Math.max(1,sessions)>=8&&views>=8)strongOutlier=true;
    }
    if(!totalCountrySessions)return null;
    var pageHomePct=pct(pageHomeSessions,totalCountrySessions),siteHomePct=siteHome?pct(siteHome.value,siteCountries.total):0,foreignPct=100-pageHomePct;
    if(foreignPct>=75&&siteHomePct-pageHomePct>=35){
      return {score:175,title:'Besöken kan vara automatiserade',text:'Sidan hade '+fmt(totalSessions)+' registrerade besök under perioden. '+fmt(foreignSessions)+' av dem var registrerade från andra länder än '+swCountry(home)+', vilket skiljer sig tydligt från webbplatsen som helhet. Det kan bero på crawlers eller andra automatiska tjänster. Sidan kan därför ha haft mycket få eller inga faktiska användare.'};
    }
    if(strongOutlier){
      return {score:170,title:'Besöken kan vara automatiserade',text:'Sidan hade '+fmt(totalSessions)+' registrerade besök under perioden och trafiken har ett ovanligt besöksmönster. Det kan bero på crawlers eller andra automatiska tjänster. Sidan kan därför ha haft färre faktiska användare än besökssiffran visar.'};
    }
    return null;
  }

  function addSourceInsight(c,localSources,siteSources,minScore){
    if(!localSources||localSources.total<100||!siteSources||siteSources.total<500)return;
    for(var i=0;i<localSources.items.length;i++){
      var it=localSources.items[i],friendly=sourceName(it.label);if(!friendly||num(it.value)<50)continue;
      var si=breakdownItemByLabel(siteSources,it.label),local=pct(it.value,localSources.total),sp=si?pct(si.value,siteSources.total):0;
      var diff=Math.round((local-sp)*10)/10,ratio=sp>0?local/sp:(local>=10?99:0);
      if(local>=15&&diff>=10&&ratio>=1.5){
        var title=friendly==='direkttrafik'?'Mer direkttrafik än vanligt':friendly==='intern trafik'?'Mer intern trafik än vanligt':'Mer trafik från '+friendly+' än vanligt';
        c.push({score:(minScore||95)+diff,title:title,text:String(local).replace('.',',')+' % av sidvisningarna har '+friendly+' som källa, jämfört med '+String(sp).replace('.',',')+' % på webbplatsen som helhet.'});
      }
    }
  }
  function insight(branchDevices,siteDevices,branchCountries,siteCountries,branchSources,siteSources,withViews,zero,totalViews,pageCount,isSiteRoot){
    var c=[];function add(score,title,text){c.push({score:score,title:title,text:text});}
    if(!isSiteRoot)addCountryInsight(c,branchCountries,siteCountries,120);
    if(!isSiteRoot&&branchDevices&&branchDevices.total>=100&&siteDevices&&siteDevices.total>=500){var bm=mobileShare(branchDevices),sm=mobileShare(siteDevices),md=Math.round((bm-sm)*10)/10;if(bm>=55&&md>=10)add(108+md,'Fler använder mobil än vanligt',Math.round(bm)+' % av besöken kommer från mobil, jämfört med '+Math.round(sm)+' % på webbplatsen som helhet. Testa särskilt viktiga sidor i mobil vy.');}
    if(!isSiteRoot)addSourceInsight(c,branchSources,siteSources,100);
    if(withViews&&withViews.length&&totalViews>0){var sh=pct(withViews[0].views,totalViews);if(sh>=60)add(80+Math.min(20,sh-60),'En sida står för '+String(sh).replace('.',',')+' % av sidvisningarna','En stor del av trafiken i grenen går till samma sida. Se till att sidan är aktuell, tydlig och tillgänglig.');}
    if(zero&&zero.length&&pageCount>0){var zs=pct(zero.length,pageCount);if(zs>=15||zero.length>=10)add(60+Math.min(20,zs),fmt(zero.length)+' publicerade sidor saknar registrerade besök','Nya eller smala sidor kan ha få eller inga besök. Använd listan för att hitta sidor du kan behöva se över.');}
    c.sort(function(a,b){return b.score-a.score;});return c.length?c[0]:null;
  }

  function renderBreakdown(title,b,key,unit){
    unit=unit||'sidvisningar';
    var h='<section class="svs-panel"><h3 class="env-ui-text-sectionheading">'+esc(title)+'</h3>';
    if(!b||!b.items.length||!b.total)return h+'<p class="svs-muted">Ingen statistik att visa för vald period.</p></section>';
    h+='<ul class="svs-bars">';var n=Math.min(6,b.items.length);
    for(var i=0;i<n;i++){var it=b.items[i],p=pct(it.value,b.total),lab=key==='location_country_name'?swCountry(it.label):it.label;
      h+='<li><div class="svs-bar-head"><strong>'+esc(lab)+'</strong><span>'+esc(String(p).replace('.',','))+' %</span></div><div class="svs-track" aria-hidden="true"><span style="width:'+Math.max(1,Math.min(100,p))+'%"></span></div><div class="svs-muted">'+fmt(it.value)+' '+esc(unit)+'</div></li>';}
    return h+'</ul></section>';
  }

  function countryDiagnostics(result){
    if(!result||!result.ok)return '<p>Länder, datakvalitet: kunde inte hämtas.</p>';
    var rs=rows(result);if(!rs.length)return '<p>Länder, datakvalitet: ingen data.</p>';
    var h='<div class="svs-table-wrap"><table class="svs-table"><caption>Länder – underlag för datakvalitet</caption><thead><tr><th scope="col">Land</th><th scope="col">Besök</th><th scope="col">Besökare</th><th scope="col">Sidvisningar</th><th scope="col">Sidvisningar/besök</th></tr></thead><tbody>';
    for(var i=0;i<Math.min(10,rs.length);i++){
      var x=rs[i],sessions=num(x.sessions),views=num(x.page_views),per=sessions?Math.round(views*10/sessions)/10:0;
      h+='<tr><th scope="row">'+esc(swCountry(label(x,'location_country_name')))+'</th><td>'+fmt(sessions)+'</td><td>'+fmt(x.visitors)+'</td><td>'+fmt(views)+'</td><td>'+esc(String(per).replace('.',','))+'</td></tr>';
    }
    return h+'</tbody></table></div>';
  }

  function networkDiagnostics(result){
    if(!result||!result.ok)return '<p>Nätverksdiagnostik: kunde inte hämtas.</p>';
    var rs=rows(result);if(!rs.length)return '<p>Nätverksdiagnostik: ingen data.</p>';
    var h='<p class="svs-muted">Höga värden för sidvisningar per besök kan vara värda att granska, men är inte i sig bevis på bottrafik.</p><div class="svs-table-wrap"><table class="svs-table"><caption>Nätverk med flest sidvisningar</caption><thead><tr><th scope="col">Land</th><th scope="col">Leverantör / organisation</th><th scope="col">Besök</th><th scope="col">Besökare</th><th scope="col">Sidvisningar</th><th scope="col">Sidvisningar/besök</th></tr></thead><tbody>';
    for(var i=0;i<Math.min(12,rs.length);i++){
      var x=rs[i],provider=String(label(x,'location_provider')),org=String(label(x,'location_organization')),sessions=num(x.sessions),views=num(x.page_views),per=sessions?Math.round(views*10/sessions)/10:0,network=provider;
      if(org&&org!=='Okänt'&&org!==provider)network+=(network&&network!=='Okänt'?' / ':'')+org;
      h+='<tr><th scope="row">'+esc(swCountry(label(x,'location_country_name')))+'</th><td>'+esc(network||'Okänt')+'</td><td>'+fmt(sessions)+'</td><td>'+fmt(x.visitors)+'</td><td>'+fmt(views)+'</td><td>'+esc(String(per).replace('.',','))+'</td></tr>';
    }
    return h+'</tbody></table></div>';
  }

  function pageLink(x){var text=String(x.name||x.id||'Sida');if(!x.url)return '<span class="svs-page-name">'+esc(text)+'</span>';return '<a class="svs-page-link" href="'+esc(x.url)+'" target="_blank" rel="noopener noreferrer" aria-label="'+esc(text+' (öppnas i ny flik)')+'">'+esc(text)+' <span class="svs-external" aria-hidden="true">↗</span></a>';}

  function variantRowsHtml(items){
    if(!items||!items.length)return '<p class="svs-muted">Inga innehållsvarianter registrerades under perioden.</p>';
    var h='<ol class="svs-list">';
    for(var i=0;i<items.length;i++){
      var x=items[i];
      h+='<li><div class="svs-page">'+pageLink(x)+'<span class="svs-status">'+fmt(x.sessions)+' besök · '+fmt(x.views)+' sidvisningar</span></div><strong class="svs-count">'+fmt(x.sessions)+'</strong></li>';
    }
    return h+'</ol>';
  }
  function trafficStatus(views,enabled){
    if(!enabled)return {cls:'',label:''};
    var v=num(views);
    if(v===0)return {cls:' svs-row-alert',label:'Ingen visning'};
    if(v<=3)return {cls:' svs-row-watch',label:'Mycket få visningar'};
    return {cls:'',label:''};
  }
  function listRows(items,a,b,highlightLow){var h='<ol class="svs-list"'+(a?' start="'+(a+1)+'"':'')+'>';for(var i=a;i<b;i++){var x=items[i],st=trafficStatus(x.views,highlightLow);h+='<li class="'+st.cls.replace(/^\s+/,'')+'"><div class="svs-page">'+pageLink(x)+(st.label?'<span class="svs-status">'+esc(st.label)+'</span>':'')+'</div><strong class="svs-count">'+fmt(x.views)+'</strong></li>';}return h+'</ol>';}

  function moreChunks(items,start,step,cap,highlightLow){if(start>=items.length||start>=cap)return '';var end=Math.min(start+step,items.length,cap),count=end-start;var h='<details class="svs-more"><summary><span class="closed">Visa '+count+' till</span><span class="open">Visa färre</span></summary>'+listRows(items,start,end,highlightLow)+moreChunks(items,end,step,cap,highlightLow);if(end>=cap&&items.length>cap)h+='<p class="svs-muted">Listan är begränsad till '+cap+' poster för att hålla dashboarden snabb.</p>';return h+'</details>';}

  function progressive(title,items,initial,step,highlightLow){var h='<section class="svs-panel svs-list-panel"><h3>'+esc(title)+'</h3>';if(!items.length)return h+'<p class="svs-muted">Inga sidor att visa.</p></section>';var first=Math.min(initial,items.length);h+=listRows(items,0,first,highlightLow);if(items.length>first)h+=moreChunks(items,first,step,1000,highlightLow);return h+'</section>';}

  function weeklyText(sessions,d){
    var w=visitsPerWeek(sessions,d);
    if(w<0.1)return 'mindre än 0,1 besök per vecka';
    return String(Math.round(w*10)/10).replace('.',',')+' besök per vecka';
  }
  function lowTrafficRows(items,a,b,d){
    var h='<ol class="svs-list"'+(a?' start="'+(a+1)+'"':'')+'>';
    for(var i=a;i<b;i++){var x=items[i];h+='<li class="svs-row-watch"><div class="svs-page">'+pageLink(x)+'<span class="svs-status">'+esc(fmt(x.sessions)+' besök under perioden · cirka '+weeklyText(x.sessions,d))+'</span></div><strong class="svs-count">'+fmt(x.sessions)+'</strong></li>';}
    return h+'</ol>';
  }
  function lowTrafficMore(items,start,step,cap,d){if(start>=items.length||start>=cap)return '';var end=Math.min(start+step,items.length,cap),count=end-start;var h='<details class="svs-more"><summary><span class="closed">Visa '+count+' till</span><span class="open">Visa färre</span></summary>'+lowTrafficRows(items,start,end,d)+lowTrafficMore(items,end,step,cap,d);if(end>=cap&&items.length>cap)h+='<p class="svs-muted">Listan är begränsad till '+cap+' poster för att hålla dashboarden snabb.</p>';return h+'</details>';}
  function lowTrafficList(items,initial,step,d,qualityWarning){
    var h='<section class="svs-panel svs-list-panel"><h3>Sidor med låg trafik</h3><p class="svs-muted">Visar sidor med högst cirka två registrerade besök per vecka i genomsnitt under den valda perioden.</p>';
    if(qualityWarning)h+='<div class="svs-warning"><strong>Automatiserad trafik kan påverka låga tal</strong><p>En del av trafiken har ett ovanligt besöksmönster som kan bero på crawlers eller andra automatiska tjänster. För sidor med mycket låg trafik kan därför några registrerade besök komma från automatiserad trafik.</p></div>';
    if(!items.length)return h+'<p class="svs-muted">Inga sidor med låg trafik hittades.</p></section>';
    var first=Math.min(initial,items.length);h+=lowTrafficRows(items,0,first,d);if(items.length>first)h+=lowTrafficMore(items,first,step,1000,d);return h+'</section>';
  }

  function shouldHighlightLowTraffic(d){
    if(!d)return false;
    if(d.mode==='7'||d.mode==='30'||d.mode==='90'||d.mode==='365'||d.mode==='previousYear')return true;
    if(d.mode==='custom'&&d.from&&d.to){var a=new Date(d.from+'T00:00:00'),b=new Date(d.to+'T00:00:00');return isFinite(a.getTime())&&isFinite(b.getTime())&&((b-a)/86400000)>=6;}
    return false;
  }


  function getOnlinePageInfo(node){
    var op=safeRequire('OnlineVersionPropertyUtil');
    var r={id:pageId(node),url:'',name:''};
    try{r.name=String(node&&node.getName?node.getName():'');}catch(ignore){}
    if(op.ok&&op.value&&op.value.getString&&r.id){try{r.url=String(op.value.getString(r.id,'URL','')||'');}catch(ignore2){}}
    return r;
  }

  function discoverPageUrl(restApp,date,id,exception){
    if(!id)return {ok:false,url:'',ms:0,statusCode:0,error:'Sidan saknar Sitevision-ID.'};
    var r=query(restApp,date,branchFilter([id]),[{column_id:'event_url'},{column_id:'page_views'}],20,[[1,'desc']]);
    if(!r.ok)return {ok:false,url:'',ms:r.ms,statusCode:r.statusCode,error:r.error};
    var rs=rows(r),fallback='';
    for(var i=0;i<rs.length;i++){
      var u=String(rs[i].event_url__label||rs[i].event_url||'');if(!/^https?:\/\//i.test(u))continue;
      if(exception){if(u.indexOf('?')<0&&isIncludedUrl(u))return {ok:true,url:u,ms:r.ms,statusCode:r.statusCode,error:''};if(urlHasAllowedQuery(u,exception)&&!fallback)fallback=u.split('?')[0].split('#')[0];}
      else if(isIncludedUrl(u))return {ok:true,url:u,ms:r.ms,statusCode:r.statusCode,error:''};
    }
    if(fallback)return {ok:true,url:fallback,ms:r.ms,statusCode:r.statusCode,error:''};
    return {ok:false,url:'',ms:r.ms,statusCode:r.statusCode,error:'Ingen publik URL hittades i Piwik för sidan.'};
  }

  function modeControls(scope,d,canUseBranch){
    if(canUseBranch===false)return '';
    var h='<div class="svs-mode" role="group" aria-label="Visa statistik för"><form method="get" target="_self">';
    h+='<input type="hidden" name="svstat_period" value="'+esc(d.mode)+'">';
    if(d.mode==='custom'){h+='<input type="hidden" name="svstat_from" value="'+esc(d.from||'')+'"><input type="hidden" name="svstat_to" value="'+esc(d.to||'')+'">';}
    h+='<button type="submit" name="svstat_scope" value="page" class="'+(scope==='page'?'active':'')+'"'+(scope==='page'?' aria-current="true"':'')+'>Denna sida</button>';
    h+='<button type="submit" name="svstat_scope" value="branch" class="'+(scope==='branch'?'active':'')+'"'+(scope==='branch'?' aria-current="true"':'')+'>Denna gren</button>';
    return h+'</form></div>';
  }

  function timeDistributionStats(result,capSeconds){
    var out={ok:false,weightedAverage:0,cappedAverage:0,totalViews:0,cappedViews:0,longViews:0,maxSeconds:0,buckets:[
      {label:'Under 10 sekunder',min:0,max:9,views:0},
      {label:'10–29 sekunder',min:10,max:29,views:0},
      {label:'30 sekunder–1 min 59 sek',min:30,max:119,views:0},
      {label:'2–9 minuter',min:120,max:599,views:0},
      {label:'10 minuter eller mer',min:600,max:null,views:0}
    ]};
    if(!result||!result.ok)return out;
    var rs=rows(result),sum=0,cappedSum=0;
    for(var i=0;i<rs.length;i++){
      var r=rs[i],raw=(typeof r.time_on_page!=='undefined'?r.time_on_page:r.time_on_page__label),seconds=num(raw),weight=num(r.page_views);
      if(!weight)continue;
      out.totalViews+=weight;sum+=seconds*weight;if(seconds>out.maxSeconds)out.maxSeconds=seconds;
      if(seconds<capSeconds){out.cappedViews+=weight;cappedSum+=seconds*weight;}else out.longViews+=weight;
      for(var b=0;b<out.buckets.length;b++){
        var bucket=out.buckets[b];
        if(seconds>=bucket.min&&(bucket.max===null||seconds<=bucket.max)){bucket.views+=weight;break;}
      }
    }
    out.weightedAverage=out.totalViews?sum/out.totalViews:0;
    out.cappedAverage=out.cappedViews?cappedSum/out.cappedViews:0;
    out.ok=out.totalViews>0;return out;
  }

  function renderTimeDistribution(stats){
    if(!stats||!stats.ok)return '';
    var h='<details class="svs-time-details"><summary>Visa tidsfördelning</summary><p class="svs-muted">Så fördelar sig de uppmätta sidvisningarna efter tid på sidan.</p><ul class="svs-time-buckets">';
    for(var i=0;i<stats.buckets.length;i++){
      var b=stats.buckets[i],p=pct(b.views,stats.totalViews);
      h+='<li><div class="svs-bar-head"><span>'+esc(b.label)+'</span><strong>'+esc(String(p).replace('.',','))+' %</strong></div><div class="svs-track" aria-hidden="true"><span style="width:'+Math.max(1,Math.min(100,p))+'%"></span></div><div class="svs-muted">'+fmt(b.views)+' sidvisningar</div></li>';
    }
    return h+'</ul></details>';
  }

  function secondsText(v){var n=Math.max(0,Math.round(num(v)));if(!n)return '–';var m=Math.floor(n/60),s=n%60;return m?m+' min '+(s?s+' s':''):s+' s';}
  function percentText(v){return String(Math.round(num(v)*10)/10).replace('.',',')+' %';}
  function ratioPercent(part,total){return total>0?(num(part)/num(total))*100:0;}
  function countOfText(part,total){return fmt(part)+' av '+fmt(total);}

  function sectionError(title,result,wide){
    if(!result||result.ok)return '';
    return '<section class="svs-panel'+(wide?' svs-wide':'')+'"><h3>'+esc(title)+'</h3><div class="svs-error"><strong>Den här delen kunde inte hämtas.</strong><p>Övrig statistik visas som vanligt. Försök igen senare.</p></div></section>';
  }
  function diagResult(result){
    if(!result)return 'ej frågad';
    var t=result.ms+' ms · HTTP '+result.statusCode;
    if(!result.ok&&result.error)t+=' · '+result.error;
    return esc(t);
  }

  function keyValueRows(title,result,key,metric,limit,translate){
    var h='<section class="svs-panel"><h3 class="env-ui-text-sectionheading">'+esc(title)+'</h3>';
    if(result&&!result.ok)return h+'<div class="svs-error"><strong>Den här delen kunde inte hämtas.</strong><p>Övrig statistik visas som vanligt. Försök igen senare.</p></div></section>';
    var rs=result&&result.ok?rows(result):[];
    if(!rs.length)return h+'<p class="svs-muted">Ingen statistik att visa för vald period.</p></section>';
    h+='<ol class="svs-kv">';var n=Math.min(limit||6,rs.length);for(var i=0;i<n;i++){var lab=String(label(rs[i],key)||'Okänt');if(translate)lab=translate(lab);h+='<li><span>'+esc(lab)+'</span><strong>'+fmt(rs[i][metric])+'</strong></li>';}
    return h+'</ol></section>';
  }

  function flowRows(title,result,titleKey,urlKey){
    var h='<section class="svs-panel"><h3 class="env-ui-text-sectionheading">'+esc(title)+'</h3>';
    if(result&&!result.ok)return h+'<div class="svs-error"><strong>Den här delen kunde inte hämtas.</strong><p>Övrig statistik visas som vanligt. Försök igen senare.</p></div></section>';
    var rs=result&&result.ok?rows(result):[];
    if(!rs.length)return h+'<p class="svs-muted">Ingen statistik att visa för vald period.</p></section>';
    h+='<ol class="svs-kv">';var shown=0;for(var i=0;i<rs.length&&shown<6;i++){var u=String(rs[i][urlKey+'__label']||rs[i][urlKey]||''),t=String(rs[i][titleKey+'__label']||rs[i][titleKey]||u||'Okänd sida');if(!u||u==='Okänt')continue;var l='<span>'+esc(t)+'</span>';if(/^https?:\/\//i.test(u))l='<a class="svs-page-link" href="'+esc(u)+'" target="_blank" rel="noopener noreferrer" aria-label="'+esc(t+' (öppnas i ny flik)')+'">'+esc(t)+' <span class="svs-external" aria-hidden="true">↗</span></a>';h+='<li>'+l+'<strong>'+fmt(rs[i].page_views)+'</strong></li>';shown++;}
    return shown?h+'</ol></section>':h+'<p class="svs-muted">Ingen statistik att visa för vald period.</p></section>';
  }

  function usefulGoogleRows(result){
    var source=result&&result.ok?rows(result):[],out=[];
    for(var i=0;i<source.length;i++){
      var r=source[i],phrase=String(label(r,'search_engine_keyword')||'').replace(/^\s+|\s+$/g,''),clicks=num(r.search_engine_clicks),impressions=num(r.search_engine_impressions);
      if(!phrase)continue;
      // Små nollrader ger sällan redaktionell nytta. Visa raden om den har gett klick
      // eller om sidan åtminstone har visats tio gånger för sökfrasen.
      if(clicks>0||impressions>=10)out.push(r);
    }
    out.sort(function(a,b){
      var ac=num(a.search_engine_clicks),bc=num(b.search_engine_clicks),ai=num(a.search_engine_impressions),bi=num(b.search_engine_impressions);
      if((ac>0)!=(bc>0))return bc>0?1:-1;
      if(ac!==bc)return bc-ac;
      return bi-ai;
    });
    return out;
  }

  function renderSearchConsole(result){
    if(result&&!result.ok)return sectionError('Sökningar där sidan syntes i Google',result,true);
    var h='<section class="svs-panel svs-wide"><h3>Sökningar där sidan syntes i Google</h3>',rs=usefulGoogleRows(result);
    if(!rs.length)return '';
    h+='<p class="svs-muted">Visningar betyder att en länk till sidan syntes i Googles sökresultat. Det betyder inte att någon klickade. Andra sidor på webbplatsen kan också visas för samma sökning.</p>';
    h+='<div class="svs-table-wrap"><table class="svs-table"><thead><tr><th scope="col">Sökfras</th><th scope="col">Visningar i Google</th><th scope="col">Klick till sidan</th><th scope="col">Andel som klickade</th><th scope="col">Genomsnittlig placering</th></tr></thead><tbody>';
    for(var i=0;i<Math.min(10,rs.length);i++){var r=rs[i],impressions=num(r.search_engine_impressions),clicks=num(r.search_engine_clicks);h+='<tr><th scope="row">'+esc(label(r,'search_engine_keyword'))+'</th><td>'+fmt(impressions)+'</td><td>'+fmt(clicks)+'</td><td>'+percentText(impressions>0?clicks*100/impressions:0)+'</td><td>'+String(Math.round(num(r.search_engine_average_position)*10)/10).replace('.',',')+'</td></tr>';}
    return h+'</tbody></table></div><p class="svs-muted">Vi visar sökfraser som har gett minst ett klick eller där sidan har visats minst 10 gånger. Data från Google Search Console kan vara några dagar fördröjd.</p></section>';
  }

  function safeHref(v,allowRelative){
    var u=String(v||'').replace(/^\s+|\s+$/g,'');
    if(/^https?:\/\//i.test(u))return u;
    if(allowRelative&&/^\/(?!\/)/.test(u))return u;
    return '';
  }
  function canonicalOutlinkUrl(url){
    return String(url||'').replace(/^\s+|\s+$/g,'').replace(/&amp;|&#0*38;|&#x0*26;/gi,'&');
  }

  function downloadName(url){
    var raw=String(url||'');
    try{raw=decodeURIComponent(raw);}catch(ignore){}
    raw=raw.split('?')[0].split('#')[0];
    var parts=raw.split('/'),name=parts.length?parts[parts.length-1]:raw;
    return name||raw||'Fil';
  }
  function downloadMergeKey(url){
    var raw=String(url||'').replace(/^\s+|\s+$/g,'');
    var match=raw.match(/^https?:\/\/[^\/]+(\/download\/[^?#]+)(?:[?#].*)?$/i);
    return match?String(match[1]).toLowerCase():raw;
  }
  function renderDownloads(result,title){
    if(result&&!result.ok)return sectionError(title||'Filer som öppnats eller laddats ner',result,true);
    var rs=result&&result.ok?rows(result):[];
    if(!rs.length)return '';
    var map={},useful=[];
    for(var i=0;i<rs.length;i++){
      var u=String(label(rs[i],'download_url')||'');
      var d=num(rs[i].downloads),ud=num(rs[i].unique_downloads);
      if(!u||(!d&&!ud))continue;
      var key=downloadMergeKey(u);
      if(!map[key]){
        map[key]={url:u,name:downloadName(u),downloads:0,unique:0,variants:0,merged:false};
        useful.push(map[key]);
      }
      map[key].downloads+=d;
      // Samma Sitevision-fil kan nås via flera domäner. Unika klick kan då
      // överlappa mellan Piwik-raderna och ska därför inte summeras.
      map[key].unique=Math.max(map[key].unique,ud);
      map[key].variants+=1;
      map[key].merged=map[key].variants>1;
    }
    if(!useful.length)return '';
    useful.sort(function(a,b){return b.downloads-a.downloads;});
    var h='<section class="svs-panel svs-wide"><h3 class="env-ui-text-sectionheading">'+esc(title||'Filer som öppnats eller laddats ner')+'</h3>';
    h+='<p class="svs-muted">Piwik registrerar klick på länkar till filer. Det visar inte om hela filen faktiskt laddades ner eller lästes. Samma Sitevision-fil som nås via flera domäner visas som en rad.</p>';
    h+='<div class="svs-table-wrap"><table class="svs-table"><thead><tr><th scope="col">Fil</th><th scope="col">Klick</th><th scope="col">Unika klick</th></tr></thead><tbody>';
    for(i=0;i<Math.min(10,useful.length);i++){
      var x=useful[i],href=safeHref(x.url,true),fileLabel=href?'<a class="svs-page-link" href="'+esc(href)+'" target="_blank" rel="noopener noreferrer" aria-label="'+esc(x.name+' (öppnas i ny flik)')+'">'+esc(x.name)+' <span class="svs-external" aria-hidden="true">↗</span></a>':'<span class="svs-page-name">'+esc(x.name)+'</span>';
      h+='<tr><th scope="row">'+fileLabel+'</th><td>'+fmt(x.downloads)+'</td><td>'+(x.merged?('minst '+fmt(x.unique)):fmt(x.unique))+'</td></tr>';
    }
    return h+'</tbody></table></div></section>';
  }

  function queryParam(url,name){
    var raw=String(url||''),q=raw.indexOf('?');
    if(q<0)return '';
    var parts=raw.substring(q+1).split('#')[0].split('&');
    for(var i=0;i<parts.length;i++){
      var bit=parts[i].split('='),key=bit.shift()||'';
      try{key=decodeURIComponent(key.replace(/\+/g,' '));}catch(ignore){}
      if(key.toLowerCase()===String(name||'').toLowerCase()){
        var value=bit.join('=');
        try{return decodeURIComponent(value.replace(/\+/g,' '));}catch(ignore2){return value;}
      }
    }
    return '';
  }
  function readableUrlPart(value){
    var raw=String(value||'');
    try{raw=decodeURIComponent(raw);}catch(ignore){}
    return raw.replace(/^https?:\/\//i,'');
  }
  function middleCompact(value,max){
    var s=String(value||''),limit=max||100;
    if(s.length<=limit)return s;
    var first=Math.max(24,Math.floor(limit*0.35)),last=Math.max(36,limit-first-1);
    return s.substring(0,first)+'…'+s.substring(s.length-last);
  }
  function outlinkName(url){
    var raw=String(url||'');
    if(!raw)return 'Extern länk';
    try{
      var hostMatch=raw.match(/^https?:\/\/([^\/?#]+)/i),host=hostMatch?hostMatch[1]:'';
      if(host&&host.toLowerCase().indexOf('readspeaker.com')>=0){
        var target=queryParam(raw,'url');
        if(target){
          var targetClean=readableUrlPart(target).split('?')[0].split('#')[0].replace(/\/+$/,'');
          var targetParts=targetClean.split('/'),pageName=targetParts[targetParts.length-1]||targetClean;
          return 'ReadSpeaker · '+middleCompact(pageName,75);
        }
      }
      var noProtocol=readableUrlPart(raw);
      var q=noProtocol.search(/[?#]/),base=q>=0?noProtocol.substring(0,q):noProtocol,hasParams=q>=0;
      base=base.replace(/\/+$/,'');
      return middleCompact(base,105)+(hasParams?' ?…':'');
    }catch(ignore){return middleCompact(raw,105);}
  }
  function outlinkRows(items,start,end){
    var h='';
    for(var i=start;i<end;i++){
      var x=items[i],href=safeHref(x.url,false),linkLabel=href?'<a class="svs-page-link" href="'+esc(href)+'" target="_blank" rel="noopener noreferrer" aria-label="'+esc('Öppna '+x.label+' i ny flik')+'">'+esc(x.label)+' <span class="svs-external" aria-hidden="true">↗</span></a>':'<span class="svs-page-name">'+esc(x.label)+'</span>';
      h+='<tr><th scope="row">'+linkLabel+'</th><td>'+fmt(x.clicks)+'</td><td>'+(x.merged?('minst '+fmt(x.unique)):fmt(x.unique))+'</td></tr>';
    }
    return h;
  }
  function renderOutlinks(result,title){
    if(result&&!result.ok)return sectionError(title||'Externa länkar som besökare klickat på',result,true);
    var rs=result&&result.ok?rows(result):[],map={},useful=[];
    for(var i=0;i<rs.length;i++){
      var u=canonicalOutlinkUrl(label(rs[i],'outlink_url')),clicks=num(rs[i].outlinks),unique=num(rs[i].unique_outlinks);
      if(!u||(!clicks&&!unique))continue;
      if(!map[u]){map[u]={url:u,label:outlinkName(u),clicks:0,unique:0,variants:0,merged:false};useful.push(map[u]);}
      map[u].clicks+=clicks;
      // Unique clicks cannot safely be summed when Piwik rows differ only by HTML encoding.
      // Show a conservative lower bound after merging.
      map[u].unique=Math.max(map[u].unique,unique);
      map[u].variants+=1;
      map[u].merged=map[u].variants>1;
    }
    if(!useful.length)return '';
    useful.sort(function(a,b){return b.clicks-a.clicks;});
    var initial=Math.min(10,useful.length),cap=Math.min(50,useful.length);
    var h='<section class="svs-panel svs-wide"><h3 class="env-ui-text-sectionheading">'+esc(title||'Externa länkar som besökare klickat på')+'</h3>';
    h+='<p class="svs-muted">Visar klick på länkar som går till en annan domän. En annan webbplats som ni själva äger kan därför också räknas som extern. Långa tekniska parametrar döljs i listan, men länken går fortfarande till den fullständiga adressen.</p>';
    h+='<div class="svs-table-wrap"><table class="svs-table"><thead><tr><th scope="col">Länk</th><th scope="col">Klick</th><th scope="col">Unika klick</th></tr></thead><tbody>'+outlinkRows(useful,0,initial)+'</tbody></table></div>';
    if(cap>initial){
      h+='<details class="svs-more svs-more-table"><summary><span class="closed">Visa fler externa länkar</span><span class="open">Visa färre</span></summary><div class="svs-table-wrap"><table class="svs-table"><caption class="svs-assistive">Fler externa länkar</caption><thead><tr><th scope="col">Länk</th><th scope="col">Klick</th><th scope="col">Unika klick</th></tr></thead><tbody>'+outlinkRows(useful,initial,cap)+'</tbody></table></div>';
      if(useful.length>cap)h+='<p class="svs-muted">Listan är begränsad till '+cap+' länkar för att hålla dashboarden snabb.</p>';
      h+='</details>';
    }
    return h+'</section>';
  }

  function friendlyTrafficSource(v){
    var x=String(v||'').replace(/^\s+|\s+$/g,''),l=x.toLowerCase();
    if(l==='direct'||l==='direct entry'||l==='direct_entry'||l==='(direct)')return 'Direkttrafik';
    if(l==='google'||l.indexOf('google.')===0)return 'Google';
    if(l==='bing'||l.indexOf('bing.')===0)return 'Bing';
    if(l==='fb'||l==='facebook'||l.indexOf('facebook.')===0)return 'Facebook';
    if(l==='ig'||l==='instagram'||l.indexOf('instagram.')===0)return 'Instagram';
    if(l==='emarketeer')return 'eMarketeer';
    if(l==='getanewsletter'||l==='get a newsletter')return 'Get a Newsletter';
    return x||'Okänt';
  }

  function friendlyCampaignSource(v){
    var x=String(v||''),l=x.toLowerCase();
    if(l==='fb'||l==='facebook')return 'Facebook';
    if(l==='ig'||l==='instagram')return 'Instagram';
    if(l==='emarketeer')return 'eMarketeer';
    if(l==='getanewsletter'||l==='get a newsletter')return 'Get a Newsletter';
    return x;
  }
  function friendlyCampaignMedium(v){
    var x=String(v||''),l=x.toLowerCase();
    if(l==='paid')return 'Betald';
    if(l==='paid_social'||l==='paidsocial')return 'Betald social';
    if(l==='email'||l==='e-mail')return 'E-post';
    if(l==='organic')return 'Organisk';
    if(l==='referral')return 'Hänvisning';
    if(l==='qr')return 'QR-kod';
    if(l==='print')return 'Trycksak';
    return x;
  }
  function renderCampaigns(result,title){
    if(result&&!result.ok)return sectionError(title||'Kampanjer som lett besökare till sidan',result,true);
    var rs=result&&result.ok?rows(result):[],useful=[];
    for(var i=0;i<rs.length;i++){
      var name=String(label(rs[i],'campaign_name')||'').replace(/^\s+|\s+$/g,''),source=friendlyCampaignSource(label(rs[i],'source')),medium=friendlyCampaignMedium(label(rs[i],'medium')),sessions=num(rs[i].sessions),visitors=num(rs[i].visitors);
      var emptyName=!name||/^(okänt|unknown|\(not set\)|not set)$/i.test(name);
      if(!emptyName&&sessions>0)useful.push({name:name,source:source,medium:medium,sessions:sessions,visitors:visitors});
    }
    if(!useful.length)return '';
    useful.sort(function(a,b){return b.sessions-a.sessions;});
    var h='<section class="svs-panel svs-wide"><h3 class="env-ui-text-sectionheading">'+esc(title||'Kampanjer som lett besökare till sidan')+'</h3>';
    h+='<p class="svs-muted">Visar besök som Piwik har kopplat till kampanjparametrar, till exempel UTM-märkta annonser, nyhetsbrev och QR-koder.</p>';
    h+='<div class="svs-table-wrap"><table class="svs-table"><thead><tr><th scope="col">Kampanj</th><th scope="col">Källa</th><th scope="col">Typ</th><th scope="col">Besök</th><th scope="col">Unika besökare</th></tr></thead><tbody>';
    for(i=0;i<Math.min(10,useful.length);i++){var x=useful[i];h+='<tr><th scope="row">'+esc(x.name)+'</th><td>'+esc(x.source==='Okänt'?'–':x.source)+'</td><td>'+esc(x.medium==='Okänt'?'–':x.medium)+'</td><td>'+fmt(x.sessions)+'</td><td>'+fmt(x.visitors)+'</td></tr>';}
    return h+'</tbody></table></div><p class="svs-muted">Kampanjen måste vara märkt när länken skapas för att Piwik ska kunna skilja den från annan trafik.</p></section>';
  }

  function isAiTrafficRow(r){
    var channel=String(label(r,'referrer_type')||'').toLowerCase(),source=String(label(r,'source')||'').toLowerCase();
    if(channel==='ai referral'||channel==='ai_referral'||channel==='ai')return true;
    var markers=['chatgpt','openai','perplexity','copilot','gemini','bard','claude','anthropic','poe','you.com','mistral','deepseek'];
    for(var i=0;i<markers.length;i++)if(source.indexOf(markers[i])>=0)return true;
    return false;
  }
  function friendlyAiSource(v){
    var x=String(v||''),l=x.toLowerCase();
    if(l.indexOf('chatgpt')>=0||l.indexOf('openai')>=0)return 'ChatGPT';
    if(l.indexOf('perplexity')>=0)return 'Perplexity';
    if(l.indexOf('copilot')>=0)return 'Microsoft Copilot';
    if(l.indexOf('gemini')>=0||l.indexOf('bard')>=0)return 'Google Gemini';
    if(l.indexOf('claude')>=0||l.indexOf('anthropic')>=0)return 'Claude';
    if(l.indexOf('deepseek')>=0)return 'DeepSeek';
    if(l.indexOf('mistral')>=0)return 'Mistral';
    if(l.indexOf('poe')>=0)return 'Poe';
    return x||'AI-tjänst';
  }
  function renderAiTraffic(result,title){
    if(result&&!result.ok)return sectionError(title||'Besök från AI-tjänster',result,true);
    var rs=result&&result.ok?rows(result):[],map={},order=[];
    for(var i=0;i<rs.length;i++){
      var r=rs[i];if(!isAiTrafficRow(r))continue;
      var source=friendlyAiSource(label(r,'source')),key=source.toLowerCase();
      if(!map[key]){map[key]={source:source,sessions:0,visitors:0};order.push(map[key]);}
      map[key].sessions+=num(r.sessions);map[key].visitors+=num(r.visitors);
    }
    order.sort(function(a,b){return b.sessions-a.sessions;});
    if(!order.length)return '';
    var h='<section class="svs-panel svs-wide"><h3 class="env-ui-text-sectionheading">'+esc(title||'Besök från AI-tjänster')+'</h3>';
    h+='<p class="svs-muted">Visar trafik som Piwik kunnat identifiera som hänvisning från en AI-tjänst. All AI-trafik går inte att identifiera, så siffrorna kan vara lägre än den verkliga trafiken.</p>';
    h+='<div class="svs-table-wrap"><table class="svs-table"><thead><tr><th scope="col">AI-tjänst</th><th scope="col">Besök</th><th scope="col">Unika besökare</th></tr></thead><tbody>';
    for(i=0;i<Math.min(10,order.length);i++){var x=order[i];h+='<tr><th scope="row">'+esc(x.source)+'</th><td>'+fmt(x.sessions)+'</td><td>'+fmt(x.visitors)+'</td></tr>';}
    return h+'</tbody></table></div></section>';
  }

  function renderInternalSearch(result){
    if(result&&!result.ok)return sectionError('Interna sökningar som leder vidare till sidan',result,true);
    var rs=result&&result.ok?rows(result):[],useful=[];
    for(var i=0;i<rs.length;i++){
      var r=rs[i],term=String(label(r,'search_keyword')||'').replace(/^\s+|\s+$/g,''),searches=num(r.searches);
      if(!term||/^(okänt|unknown|\(not set\)|not set)$/i.test(term)||searches<=0)continue;
      useful.push({term:term,searches:searches});
    }
    if(!useful.length)return '';
    var h='<section class="svs-panel svs-wide"><h3>Interna sökningar som leder vidare till sidan</h3><ol class="svs-kv">';
    for(i=0;i<Math.min(10,useful.length);i++)h+='<li><span>'+esc(useful[i].term)+'</span><strong>'+fmt(useful[i].searches)+' sökningar</strong></li>';
    return h+'</ol></section>';
  }

  function renderReferrers(result){
    if(result&&!result.ok)return sectionError('Hänvisande webbplatser och sidor',result,false);
    var rs=result&&result.ok?rows(result):[],useful=[];
    for(var i=0;i<rs.length;i++){
      var r=rs[i],url=String(label(r,'referrer_url')||'').replace(/^\s+|\s+$/g,''),views=num(r.page_views);
      if(!url||/^(okänt|unknown|\(not set\)|not set)$/i.test(url)||views<=0)continue;
      useful.push({url:url,views:views});
    }
    if(!useful.length)return '';
    var h='<section class="svs-panel"><h3>Hänvisande webbplatser och sidor</h3><ol class="svs-kv">';
    for(i=0;i<Math.min(6,useful.length);i++){
      var x=useful[i],labelText=outlinkName(x.url);
      h+='<li><a class="svs-page-link" href="'+esc(x.url)+'" target="_blank" rel="noopener noreferrer" aria-label="'+esc(labelText+' (öppnas i ny flik)')+'">'+esc(labelText)+' <span class="svs-external" aria-hidden="true">↗</span></a><strong>'+fmt(x.views)+'</strong></li>';
    }
    return h+'</ol></section>';
  }

  function pageInsight(v,devices,siteDevices,countries,siteCountries,sources,siteSources,gsc,internal,avgTime,medianTime,timeStats){
    var c=[];function add(score,title,text){c.push({score:score,title:title,text:text});}
    addCountryInsight(c,countries,siteCountries,125);
    if(devices&&devices.total>=100&&siteDevices&&siteDevices.total>=500){var ms=mobileShare(devices),sm=mobileShare(siteDevices),md=Math.round((ms-sm)*10)/10;if(ms>=55&&md>=10)add(112+md,'Fler använder mobil än vanligt',Math.round(ms)+' % av besöken sker i mobil, jämfört med '+Math.round(sm)+' % på webbplatsen som helhet. Testa sidan extra noga i mobil vy.');}
    addSourceInsight(c,sources,siteSources,105);
    if(timeStats&&timeStats.ok&&timeStats.totalViews>=50&&num(medianTime)>0&&num(avgTime)>=Math.max(num(medianTime)*3,num(medianTime)+45)){
      var timeText='Hälften av de uppmätta sidvisningarna var '+secondsText(medianTime)+' eller kortare, medan genomsnittet blev '+secondsText(avgTime)+'.';
      if(timeStats.longViews>0)timeText+=' '+fmt(timeStats.longViews)+' av '+fmt(timeStats.totalViews)+' sidvisningar hade en uppmätt tid på minst 10 minuter.';
      add(132,'Stor skillnad i hur länge sidan används',timeText);
    }
    var pageBounce=ratioPercent(v.bounces,v.entries),pageExit=ratioPercent(v.exits,v.sessions);
    if(pageBounce>=50&&num(v.entries)>=50)add(88,'Många besök börjar och slutar på sidan',percentText(pageBounce)+' av besöken som började på sidan slutade utan att besökaren gick vidare till en annan sida.');
    if(pageExit>=60&&num(v.sessions)>=50)add(82,'Många besök slutar på den här sidan',percentText(pageExit)+' av besöken där sidan visades avslutades på den här sidan. Det kan vara helt naturligt om sidan ger ett tydligt slut på ett ärende.');
    if(gsc&&gsc.ok&&rows(gsc).length){
      var grs=usefulGoogleRows(gsc),totalClicks=0,topClickRow=null;
      for(var i=0;i<grs.length;i++){
        var clicks=num(grs[i].search_engine_clicks);totalClicks+=clicks;
        if(clicks>0&&(!topClickRow||clicks>num(topClickRow.search_engine_clicks)))topClickRow=grs[i];
      }
      if(topClickRow&&totalClicks>=20){
        var topClicks=num(topClickRow.search_engine_clicks),topShare=topClicks*100/totalClicks;
        if(topClicks>=10&&topShare>=40)add(92,'En Google-sökning står för stor del av klicken till sidan','Sökfrasen “'+String(label(topClickRow,'search_engine_keyword'))+'” står för '+percentText(topShare)+' av klicken från de vanligaste Google-sökningarna som visar den här sidan.');
      }
    }
    if(internal&&internal.ok&&rows(internal).length){
      var irs=rows(internal),top=num(irs[0].searches),sum=0;for(var j=0;j<irs.length;j++)sum+=num(irs[j].searches);var share=sum>0?top*100/sum:0;
      if(top>=10&&share>=40)add(90,'En intern sökning leder ofta till sidan','Sökningen “'+String(label(irs[0],'search_keyword'))+'” står för '+percentText(share)+' av de vanligaste interna sökningarna som leder vidare till sidan.');
      else if(top>=10)add(70,'Besökare hittar sidan via intern sök',fmt(top)+' sökningar på “'+String(label(irs[0],'search_keyword'))+'” leder vidare till sidan.');
    }
    c.sort(function(a,b){return b.score-a.score;});return c.length?c[0]:null;
  }

  function dateControls(d,scope){var ps=[['today','Idag'],['7','7 dagar'],['30','30 dagar'],['90','90 dagar'],['365','365 dagar'],['previousYear','Förra året']];var h='<div class="svs-period"><form method="get" target="_self"><input type="hidden" name="svstat_scope" value="'+esc(scope||'branch')+'">';
    for(var i=0;i<ps.length;i++)h+='<button type="submit" name="svstat_period" value="'+ps[i][0]+'" class="'+(d.mode===ps[i][0]?'active':'')+'"'+(d.mode===ps[i][0]?' aria-current="true"':'')+'>'+ps[i][1]+'</button>';h+='</form><details'+(d.mode==='custom'?' open':'')+'><summary>Välj egna datum</summary><form method="get" target="_self" class="svs-custom"><input type="hidden" name="svstat_scope" value="'+esc(scope||'branch')+'"><input type="hidden" name="svstat_period" value="custom"><label>Från <input type="date" name="svstat_from" value="'+esc(d.from||'')+'" required></label><label>Till <input type="date" name="svstat_to" value="'+esc(d.to||'')+'" required></label><button type="submit">Visa</button></form></details></div>';return h;}

  function reportActions(){
    return '<div class="svs-report-actions"><button type="button" class="env-button svs-print-button">Skriv ut / spara som PDF</button></div>';
  }

  function timeSeriesSpec(d){
    var days=periodDays(d);
    if(d&&d.mode==='today')return {transformation:'to_start_of_hour',label:'per timme',kind:'hour'};
    if(d&&d.mode==='365'||d&&d.mode==='previousYear')return {transformation:'to_start_of_week',label:'per vecka',kind:'week'};
    if(d&&d.mode==='custom'){
      if(days<=90)return {transformation:'to_date',label:'per dag',kind:'day'};
      if(days<=730)return {transformation:'to_start_of_week',label:'per vecka',kind:'week'};
      return {transformation:'to_start_of_month',label:'per månad',kind:'month'};
    }
    if(days<=90)return {transformation:'to_date',label:'per dag',kind:'day'};
    return {transformation:'to_start_of_week',label:'per vecka',kind:'week'};
  }
  function timeSeriesQuery(restApp,date,filter){
    var spec=timeSeriesSpec(date);
    var result=query(restApp,date,filter,[{column_id:'timestamp',transformation_id:spec.transformation},{column_id:'page_views'}],500,[[0,'asc']]);
    result.seriesSpec=spec;
    return result;
  }
  function transformedTimestamp(row,spec){
    if(!row)return '';
    var keys=['timestamp__'+spec.transformation,'timestamp'];
    for(var i=0;i<keys.length;i++)if(typeof row[keys[i]]!=='undefined')return String(row[keys[i]]||'');
    for(var k in row)if(Object.prototype.hasOwnProperty.call(row,k)&&k.indexOf('timestamp')===0)return String(row[k]||'');
    return '';
  }
  function svMonth(n){var m=['jan','feb','mar','apr','maj','jun','jul','aug','sep','okt','nov','dec'];return m[Math.max(0,Math.min(11,Number(n)-1))]||'';}
  function seriesLabel(raw,kind){
    var s=String(raw||'');
    var m=s.match(/(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):?(\d{2})?)?/);
    if(!m)return s;
    if(kind==='hour')return (m[4]||'00')+'.00';
    if(kind==='month')return svMonth(m[2])+' '+m[1];
    return Number(m[3])+' '+svMonth(m[2]);
  }
  function timeSeriesItems(result){
    if(!result||!result.ok)return [];
    var spec=result.seriesSpec||{transformation:'to_date',kind:'day'},rs=rows(result),out=[];
    for(var i=0;i<rs.length;i++){
      var raw=transformedTimestamp(rs[i],spec),views=num(rs[i].page_views);
      if(raw)out.push({raw:raw,label:seriesLabel(raw,spec.kind),views:views});
    }
    return out;
  }
  function renderTimeSeries(result,totalViews){
    if(result&&!result.ok)return sectionError('Sidvisningar över tid',result,true);
    var items=timeSeriesItems(result);
    if(!items.length)return '';
    var W=820,H=280,L=52,R=18,T=18,B=48,plotW=W-L-R,plotH=H-T-B,max=0;
    for(var i=0;i<items.length;i++)if(items[i].views>max)max=items[i].views;
    max=Math.max(1,max);
    var pts=[],circles='',labels='',grid='',ticks=4;
    for(i=0;i<=ticks;i++){
      var gv=Math.round(max*(ticks-i)/ticks),gy=T+(plotH*i/ticks);
      grid+='<line x1="'+L+'" y1="'+gy+'" x2="'+(W-R)+'" y2="'+gy+'" class="svs-chart-grid"/><text x="'+(L-8)+'" y="'+(gy+4)+'" text-anchor="end" class="svs-chart-axis">'+fmt(gv)+'</text>';
    }
    var labelEvery=Math.max(1,Math.ceil(items.length/7));
    for(i=0;i<items.length;i++){
      var x=items.length===1?L+plotW/2:L+(plotW*i/(items.length-1)),y=T+plotH-(items[i].views/max*plotH);
      pts.push(x+','+y);
      circles+='<circle cx="'+x+'" cy="'+y+'" r="3.5"><title>'+esc(items[i].label+': '+fmt(items[i].views)+' sidvisningar')+'</title></circle>';
      if(i%labelEvery===0||i===items.length-1)labels+='<text x="'+x+'" y="'+(H-18)+'" text-anchor="middle" class="svs-chart-axis">'+esc(items[i].label)+'</text>';
    }
    var table='<details class="svs-chart-data"><summary>Visa värden i tabell</summary><div class="svs-table-wrap"><table class="svs-table"><thead><tr><th scope="col">Tid</th><th scope="col">Sidvisningar</th></tr></thead><tbody>';
    var sum=0;for(i=0;i<items.length;i++){sum+=items[i].views;table+='<tr><th scope="row">'+esc(items[i].label)+'</th><td>'+fmt(items[i].views)+'</td></tr>';}
    table+='</tbody></table></div></details>';
    var note=num(totalViews)&&sum!==Math.round(num(totalViews))?'<p class="svs-muted">Grafens grupper summerar till '+fmt(sum)+' sidvisningar. Totalsiffran ovan är '+fmt(totalViews)+'.</p>':'';
    return '<section class="svs-panel svs-wide svs-chart-panel"><div class="svs-chart-head"><div><h3>Sidvisningar över tid</h3><p class="svs-muted">'+esc((result.seriesSpec&&result.seriesSpec.label)||'')+'</p></div></div><div class="svs-chart-scroll"><svg class="svs-chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Diagram över sidvisningar över tid">'+grid+'<polyline points="'+pts.join(' ')+'" class="svs-chart-line"/>'+circles+labels+'</svg></div>'+note+table+'</section>';
  }

  function css(){return '<style>.svs{font-family:Arial,sans-serif;color:#222;line-height:1.4}.svs *{box-sizing:border-box}.svs-head{display:flex;justify-content:space-between;gap:1rem;align-items:flex-start}.svs h2{font-size:1.55rem;line-height:1.2;margin:0}.svs h3{font-size:1.05rem;margin:0 0 .8rem}.svs-sub{font-weight:600;color:#555;margin-top:.25rem}.svs-badge{border:1px solid #c9ced4;border-radius:999px;padding:.45rem .75rem;white-space:nowrap;background:#fff;font-size:.9rem}.svs-mode{margin:.85rem 0 .2rem}.svs-mode form{display:inline-flex;border:1px solid #bfc6ce;border-radius:.5rem;overflow:hidden}.svs-mode button{border:0;background:#fff;padding:.5rem .9rem;font:inherit;cursor:pointer}.svs-mode button+button{border-left:1px solid #bfc6ce}.svs-mode button.active{background:#eef5ff;font-weight:700}.svs-mode button:focus-visible{outline:3px solid #1d70b8;outline-offset:-3px}.svs-period{border-bottom:1px solid #dde1e5;padding:1rem 0 1.15rem;margin-bottom:1rem}.svs-period form{display:flex;gap:.45rem;flex-wrap:wrap}.svs-period button,.svs-period summary{border:1px solid #bfc6ce;border-radius:999px;background:#fff;padding:.45rem .8rem;cursor:pointer;font:inherit}.svs-period button:hover,.svs-period summary:hover{background:#f5f7f9}.svs-period button:focus-visible,.svs-period summary:focus-visible,.svs-page-link:focus-visible{outline:3px solid #1d70b8;outline-offset:2px}.svs-period button.active{background:#eef5ff;border-color:#6d9ed6;font-weight:700}.svs-period details{margin-top:.7rem}.svs-period details>summary{display:inline-block}.svs-custom{margin-top:.75rem;align-items:end}.svs-custom label{display:flex;flex-direction:column;gap:.25rem;font-weight:600}.svs-custom input{padding:.45rem;border:1px solid #bfc6ce;border-radius:.25rem}.svs-metrics,.svs-health{display:grid;gap:.8rem}.svs-metrics{grid-template-columns:repeat(auto-fit,minmax(13rem,1fr))}.svs-health{grid-template-columns:repeat(3,minmax(0,1fr));margin-top:.8rem}.svs-metric,.svs-panel{border:1px solid #d4d8dd;border-radius:.5rem;background:#fff;padding:1rem}.svs-metric .v{font-size:1.8rem;line-height:1.1;font-weight:700;margin:.25rem 0;font-variant-numeric:tabular-nums}.svs-muted{color:#666;font-size:.9rem}.svs-grid{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(20rem,.85fr);gap:1rem;margin-top:1rem}.svs-list-panel{margin-bottom:1rem}.svs-list{list-style:none;padding:0;margin:0}.svs-list li{display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;border-bottom:1px solid #e4e6e8;padding:.65rem 0}.svs-list li:last-child{border-bottom:0}.svs-page{min-width:0}.svs-page-link,.svs-page-name{font-weight:700;color:#222;text-decoration:none;overflow-wrap:anywhere}.svs-page-link:hover{text-decoration:underline}.svs-external{font-size:.85em;font-weight:400}.svs-count{font-variant-numeric:tabular-nums;white-space:nowrap}.svs-row-watch{background:#fff8e8;border-left:4px solid #a56b00;padding-left:.55rem!important;padding-right:.45rem!important}.svs-row-alert{background:#fff1f1;border-left:4px solid #a63d40;padding-left:.55rem!important;padding-right:.45rem!important}.svs-status{display:block;margin-top:.15rem;font-size:.82rem;font-weight:600;color:#555}.svs-row-watch .svs-status{color:#735000}.svs-row-alert .svs-status{color:#8a2f32}.svs-metric-alert{background:#fff4f4;border-color:#d7a8aa}.svs-more>summary{font-weight:700;cursor:pointer;padding:.7rem 0}.svs-more .open{display:none}.svs-more[open]>summary .closed{display:none}.svs-more[open]>summary .open{display:inline}.svs-bars{list-style:none;padding:0;margin:0}.svs-bars li{margin:.7rem 0}.svs-bar-head{display:flex;justify-content:space-between;gap:1rem}.svs-track{height:.5rem;background:#e5e7ea;border-radius:99px;overflow:hidden;margin:.3rem 0}.svs-track span{display:block;height:100%;background:#3f6fa8}.svs-insight{margin-top:1rem;border:1px solid #cfd8e3;border-radius:.5rem;padding:1rem;background:#f7f9fc}.svs-insight h3{margin-bottom:.45rem}.svs-insight strong{display:block;margin-bottom:.2rem}.svs-insight p{margin:.2rem 0 0}.svs-diag{margin-top:1rem;border-top:1px solid #ddd;padding-top:.7rem}.svs-error{border-left:4px solid #c33;background:#fff5f5;padding:1rem}.svs-kv{list-style:none;margin:0;padding:0}.svs-kv li{display:flex;justify-content:space-between;gap:1rem;padding:.55rem 0;border-bottom:1px solid #e4e6e8}.svs-kv li:last-child{border-bottom:0}.svs-wide{margin-top:1rem}.svs-table-wrap{overflow-x:auto}.svs-table{width:100%;border-collapse:collapse}.svs-table th,.svs-table td{text-align:left;padding:.55rem .65rem;border-bottom:1px solid #e4e6e8}.svs-table td{font-variant-numeric:tabular-nums}.svs-assistive{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}.svs-warning{border-left:4px solid #b8860b;background:#fffaf0;padding:.8rem;margin-top:1rem}.svs-progressive-note{margin-top:1rem;padding:.8rem 1rem;border:1px solid #d4d8dd;border-radius:.5rem;background:#f7f9fc;color:#555;font-size:.9rem}.svs-time-card{min-width:0}.svs-time-pair{display:grid;grid-template-columns:1fr 1fr;gap:1rem}.svs-time-pair>div+div{border-left:1px solid #e1e4e8;padding-left:1rem}.svs-time-details{margin-top:.75rem;border-top:1px solid #e1e4e8;padding-top:.6rem}.svs-time-details summary{font-weight:700;cursor:pointer}.svs-time-details summary:focus-visible{outline:3px solid #1d70b8;outline-offset:2px}.svs-time-buckets{list-style:none;padding:0;margin:.5rem 0 0}.svs-time-buckets li{margin:.55rem 0}.svs-time-buckets .svs-track{margin:.2rem 0}.svs-report-actions{display:flex;justify-content:flex-end;margin:.2rem 0 1rem}.svs-print-button{border:1px solid #bfc6ce;border-radius:.35rem;background:#fff;padding:.55rem .9rem;cursor:pointer;font:inherit;font-weight:700}.svs-print-button:hover{background:#f5f7f9}.svs-print-button:focus-visible{outline:3px solid #1d70b8;outline-offset:2px}.svs-chart-panel{padding:1rem}.svs-chart-head{display:flex;justify-content:space-between;gap:1rem}.svs-chart-head p{margin:.1rem 0 .7rem}.svs-chart-scroll{overflow-x:auto}.svs-chart{display:block;width:100%;min-width:34rem;height:auto}.svs-chart-grid{stroke:#d9dde2;stroke-width:1}.svs-chart-line{fill:none;stroke:#1976b9;stroke-width:3;stroke-linejoin:round;stroke-linecap:round}.svs-chart circle{fill:#1976b9}.svs-chart-axis{fill:#555;font-size:12px}.svs-chart-data{margin-top:.65rem}.svs-chart-data summary{font-weight:700;cursor:pointer}.svs-chart-data summary:focus-visible{outline:3px solid #1d70b8;outline-offset:2px}@media(max-width:850px){.svs-metrics,.svs-health,.svs-grid{grid-template-columns:1fr}.svs-head{display:block}.svs-badge{display:inline-block;margin-top:.6rem}}</style>';}

  function renderStatistics(req,res,forceCoreOnly){
    // 1.6.6: Jag mäter nu hela serverkedjan även på sidnivå, inte bara Piwik-frågorna.
    // Då kan vi se om väntan ligger i Sitevision-trädet, filterbygget, Piwik,
    // jämförelsefrågorna eller vår egen bearbetning/rendering.
    var requestStart=Date.now(),phaseStart=requestStart;
    var app=safeRequire('appData'),data=app.ok?app.value:null,glob=safeRequire('globalAppData'),globalData=glob.ok?glob.value:null;
    PAGE_ID_DIM=validPageIdDimension(get(globalData,'pageIdDimension','event_custom_dimension_1'));
    excludeSettings={
      printable:bool(get(globalData,'excludePrintable',true),true),
      queryString:bool(get(globalData,'excludeQueryString',true),true),
      inloggad:bool(get(globalData,'excludeInloggad',true),true),
      systemParts:bool(get(globalData,'excludeSystemParts',true),true),
      customPatterns:parsePatterns(get(globalData,'customExcludePatterns','')),
      queryExceptions:loadQueryExceptions(globalData)
    };
    // Standalone-routen kan inte förutsättas ha samma lokala appData-kontext som
    // widgetens root-rendering. Root skickar därför med den effektiva globala widgetkonfigurationen
    // som svcfg_* parametrar. Användarens val av period/sida-gren ligger fortfarande i
    // svstat_* och har företräde framför standardvärdena.
    var d=dateSpec(req,String(configured(req,globalData,'defaultPeriod','7'))),initial=Math.max(3,Math.min(20,Number(configured(req,globalData,'initialRows',5))||5)),step=Math.max(5,Math.min(50,Number(configured(req,globalData,'moreRows',10))||10)),diagnostics=bool(get(globalData,'showDiagnostics',false),false);
    var defaultScope=String(configured(req,globalData,'defaultScope','branch'));if(defaultScope!=='page')defaultScope='branch';
    var scope=String(req&&req.params&&req.params.svstat_scope||defaultScope);if(scope!=='page')scope='branch';
    var coreOnly=forceCoreOnly===true||String(req&&req.params&&req.params.svstat_core||'')==='1';
    var showTopLists=bool(configured(req,globalData,'showTopLists',true),true),showZeroViews=bool(configured(req,globalData,'showZeroViews',true),true),showDevices=bool(configured(req,globalData,'showDevices',true),true),showCountries=bool(configured(req,globalData,'showCountries',true),true),showDownloads=bool(configured(req,globalData,'showDownloads',true),true),showOutlinks=bool(configured(req,globalData,'showOutlinks',true),true),showCampaigns=bool(configured(req,globalData,'showCampaigns',true),true),showAiTraffic=bool(configured(req,globalData,'showAiTraffic',true),true),showInsights=bool(configured(req,globalData,'showInsights',true),true);
    var highlightLowTraffic=shouldHighlightLowTraffic(d);
    var configMs=Date.now()-phaseStart;phaseStart=Date.now();
    var pg=getCurrentPage();if(!pg.ok)return res.send(css()+'<div class="svs"><div class="svs-error">'+esc(pg.error)+'</div></div>');
    var site=getSiteContext();if(!site.ok)return res.send(css()+'<div class="svs"><div class="svs-error">'+esc(site.error)+'</div></div>');
    var rr=safeRequire('RestAppInvokerFactory');if(!rr.ok||!rr.value||!rr.value.fromPath)return res.send(css()+'<div class="svs"><div class="svs-error">Sitevisions Piwik-backend kunde inte laddas.</div></div>');
    var rest;try{rest=rr.value.fromPath(BACKEND);}catch(e){rest=null;}if(!rest||!rest.post)return res.send(css()+'<div class="svs"><div class="svs-error">Sitevisions Piwik-backend kunde inte hittas.</div></div>');
    var contextMs=Date.now()-phaseStart;
    var isSiteRoot=pg.id===site.siteId||pg.type==='sv:sitePage';
    phaseStart=Date.now();
    var canUseBranch=isSiteRoot?true:hasPublishedDescendant(pg.node);
    var branchCheckMs=Date.now()-phaseStart;
    phaseStart=Date.now();
    var detectedOrigin=discoverPiwikOrigin(rest,d,site.siteId),activeOrigin=detectedOrigin.ok?detectedOrigin.origin:'';
    var originLookupMs=Date.now()-phaseStart;
    if(!canUseBranch)scope='page';

    if(scope==='page'){
      phaseStart=Date.now();
      var currentException=queryExceptionForPage(pg.id),onlinePageInfo=getOnlinePageInfo(pg.node),pageUrlResult=discoverPageUrl(rest,d,pg.id,currentException),pageUrl=pageUrlResult&&pageUrlResult.ok?pageUrlResult.url:onlinePageInfo.url;
      var pageUrlMs=Date.now()-phaseStart;
      phaseStart=Date.now();
      var pf=pageContentFilter(pg.id);
      var pageFilterMs=Date.now()-phaseStart;
      var pageQueriesStart=Date.now();
      var totals=query(rest,d,pf,[{column_id:'page_views'},{column_id:'sessions'},{column_id:'visitors'},{column_id:'entries'},{column_id:'bounces'},{column_id:'exits'},{column_id:'unique_page_views'}],1,[]);
      if(coreOnly){
        var cv=totals.ok?first(totals):{};
        var ch=css()+'<div class="svs"><div class="svs-head"><div><h2 class="env-ui-text-heading">Besöksstatistik</h2><div class="svs-sub">'+esc(pg.name||'Denna sida')+' · Denna sida</div></div><div class="svs-badge">'+esc(d.label)+'</div></div>'+modeControls(scope,d,canUseBranch)+dateControls(d,scope);
        ch+='<div class="svs-metrics"><div class="svs-metric"><div>Sidvisningar</div><div class="v">'+(totals.ok?fmt(cv.page_views):'–')+'</div></div><div class="svs-metric"><div>Unika sidvisningar</div><div class="v">'+(totals.ok?fmt(cv.unique_page_views):'–')+'</div></div><div class="svs-metric"><div>Besök</div><div class="v">'+(totals.ok?fmt(cv.sessions):'–')+'</div></div><div class="svs-metric"><div>Unika besökare</div><div class="v">'+(totals.ok?fmt(cv.visitors):'–')+'</div></div></div>';
        ch+='<div class="svs-progressive-note" role="status">Grundstatistiken är klar. Resten av statistiken hämtas fortfarande…</div></div>';
        return res.send(ch);
      }
      var pageSeries=timeSeriesQuery(rest,d,pf);
      var avgTime=query(rest,d,pf,[{column_id:'time_on_page',transformation_id:'average'},{column_id:'time_on_page',transformation_id:'median'},{column_id:'time_on_page',transformation_id:'sum'}],1,[]);
      var timeDist=query(rest,d,pf,[{column_id:'time_on_page'},{column_id:'page_views'}],2000,[[0,'asc']]);
      // Länder och enheter beskriver vilka besök vi har, inte hur många sidor de råkar ladda.
      // Därför sorterar och procentberäknar jag dessa på sessioner. Sidvisningar följer ändå
      // med i svaret så att vi kan upptäcka ovanliga mönster i diagnostiken.
      var devices=query(rest,d,pf,[{column_id:'device_type'},{column_id:'sessions'},{column_id:'visitors'},{column_id:'page_views'}],20,[[1,'desc']]);
      var countries=query(rest,d,pf,[{column_id:'location_country_name'},{column_id:'sessions'},{column_id:'visitors'},{column_id:'page_views'}],20,[[1,'desc']]);
      var sources=query(rest,d,pf,[{column_id:'source'},{column_id:'page_views'}],20,[[1,'desc']]);
      var referrers=query(rest,d,pf,[{column_id:'referrer_url'},{column_id:'page_views'}],20,[[1,'desc']]);
      var previous=query(rest,d,pf,[{column_id:'previous_event_title'},{column_id:'previous_event_url'},{column_id:'page_views'}],20,[[2,'desc']]);
      var next=query(rest,d,pf,[{column_id:'next_event_title'},{column_id:'next_event_url'},{column_id:'page_views'}],20,[[2,'desc']]);
      var gsc=null,internal=null,downloads=null,outlinks=null,campaigns=null,aiTraffic=null;
      if(pageUrl){
        var gf={operator:'and',conditions:[currentException?urlOrQueryFilter('session_entry_url',pageUrl):{column_id:'session_entry_url',condition:{operator:'eq',value:pageUrl}}]};
        gsc=query(rest,d,gf,[{column_id:'search_engine_keyword'},{column_id:'search_engine_clicks'},{column_id:'search_engine_impressions'},{column_id:'search_engine_ctr'},{column_id:'search_engine_average_position'}],100,[[2,'desc']]);
        var sf={operator:'and',conditions:[currentException?urlOrQueryFilter('next_event_url',pageUrl):{column_id:'next_event_url',condition:{operator:'eq',value:pageUrl}}]};
        internal=query(rest,d,sf,[{column_id:'search_keyword'},{column_id:'searches'},{column_id:'unique_searches'}],20,[[1,'desc']]);
        var pageEventScope=currentException?branchEventFilter([pg.id]):pageEventFilter(pageUrl);
        if(showDownloads)downloads=query(rest,d,pageEventScope,[{column_id:'download_url'},{column_id:'downloads'},{column_id:'unique_downloads'}],100,[[1,'desc']]);
        if(showOutlinks)outlinks=query(rest,d,pageEventScope,[{column_id:'outlink_url'},{column_id:'outlinks'},{column_id:'unique_outlinks'}],100,[[1,'desc']]);
      }
      if(showCampaigns)campaigns=query(rest,d,pf,[{column_id:'campaign_name'},{column_id:'source'},{column_id:'medium'},{column_id:'sessions'},{column_id:'visitors'}],100,[[3,'desc']]);
      if(showAiTraffic)aiTraffic=query(rest,d,pf,[{column_id:'referrer_type'},{column_id:'source'},{column_id:'medium'},{column_id:'sessions'},{column_id:'visitors'}],100,[[3,'desc']]);
      var trafficQuality=diagnostics?query(rest,d,pf,[{column_id:'location_country_name'},{column_id:'location_provider'},{column_id:'location_organization'},{column_id:'sessions'},{column_id:'visitors'},{column_id:'page_views'}],100,[[5,'desc']]):null;
      var pageVariants=null,pageVariantRows=[];
      if(currentException){var evf=exceptionOnlyFilter([currentException]);if(evf){pageVariants=query(rest,d,evf,[{column_id:PAGE_ID_DIM},{column_id:'event_url'},{column_id:'event_title'},{column_id:'sessions'},{column_id:'visitors'},{column_id:'page_views'}],1000,[[3,'desc']]);pageVariantRows=exceptionVariants(pageVariants,(function(){var o={};o[pg.id]=pg.name;return o;}()));}}
      var pageMainQueriesMs=Date.now()-pageQueriesStart;
      phaseStart=Date.now();
      var totalsOk=!!totals.ok,v=totalsOk?first(totals):{},tm=avgTime.ok?first(avgTime):{},avg=tm.time_on_page__average||tm.time_on_page||0,median=tm.time_on_page__median||0,sumTime=tm.time_on_page__sum||0,timeCheck=timeDistributionStats(timeDist,600),dev=devices.ok?breakdown(devices,'device_type','sessions'):null,cnt=countries.ok?breakdown(countries,'location_country_name','sessions'):null,src=sources.ok?breakdown(sources,'source','page_views'):null;
      var pageProcessingBeforeCompareMs=Date.now()-phaseStart;
      var siteDevPage=null,siteCntPage=null,siteSrcPage=null,siteDevResult=null,siteCntResult=null,siteSrcResult=null;
      var pageComparisonStart=Date.now();
      if(showInsights&&activeOrigin){var sitePageFilter=siteUrlFilter(activeOrigin);siteDevResult=query(rest,d,sitePageFilter,[{column_id:'device_type'},{column_id:'sessions'},{column_id:'visitors'},{column_id:'page_views'}],20,[[1,'desc']]);siteCntResult=query(rest,d,sitePageFilter,[{column_id:'location_country_name'},{column_id:'sessions'},{column_id:'visitors'},{column_id:'page_views'}],20,[[1,'desc']]);siteSrcResult=query(rest,d,sitePageFilter,[{column_id:'source'},{column_id:'page_views'}],20,[[1,'desc']]);siteDevPage=siteDevResult.ok?breakdown(siteDevResult,'device_type','sessions'):null;siteCntPage=siteCntResult.ok?breakdown(siteCntResult,'location_country_name','sessions'):null;siteSrcPage=siteSrcResult.ok?breakdown(siteSrcResult,'source'):null;}
      var pageComparisonMs=Date.now()-pageComparisonStart;
      phaseStart=Date.now();
      var note=totalsOk?pageInsight(v,dev,siteDevPage,cnt,siteCntPage,src,siteSrcPage,gsc,internal,avg,median,timeCheck):null;
      var pageQualityNote=pageTrafficQualityInsight(countries,siteCntPage,v.sessions,d);if(pageQualityNote&&(!note||pageQualityNote.score>note.score))note=pageQualityNote;
      var pageProcessingAfterCompareMs=Date.now()-phaseStart;
      var pageProcessingMs=pageProcessingBeforeCompareMs+pageProcessingAfterCompareMs;
      var pageRenderStart=Date.now();
      var h=css()+'<div class="svs"><div class="svs-head"><div><h2 class="env-ui-text-heading">Besöksstatistik</h2><div class="svs-sub">'+esc(pg.name||'Denna sida')+' · Denna sida</div></div><div class="svs-badge">'+esc(d.label)+'</div></div>'+modeControls(scope,d,canUseBranch)+dateControls(d,scope)+reportActions();
      var pageBouncePct=totalsOk?ratioPercent(v.bounces,v.entries):0,pageExitPct=totalsOk?ratioPercent(v.exits,v.sessions):0;
      h+='<div class="svs-metrics"><div class="svs-metric"><div>Sidvisningar</div><div class="v">'+(totalsOk?fmt(v.page_views):'–')+'</div><div class="svs-muted">Antal gånger sidan visades. Samma person kan visa sidan flera gånger.</div></div><div class="svs-metric"><div>Unika sidvisningar</div><div class="v">'+(totalsOk?fmt(v.unique_page_views):'–')+'</div><div class="svs-muted">Sidan räknas högst en gång per besök, även om samma person öppnar den flera gånger under samma besök.</div></div><div class="svs-metric"><div>Besök</div><div class="v">'+(totalsOk?fmt(v.sessions):'–')+'</div><div class="svs-muted">Antal besök där sidan ingick. Samma person kan göra flera besök.</div></div><div class="svs-metric"><div>Unika besökare</div><div class="v">'+(totalsOk?fmt(v.visitors):'–')+'</div><div class="svs-muted">Ungefärligt antal olika besökare som såg sidan under perioden. En person räknas bara en gång.</div></div></div>';
      h+=renderTimeSeries(pageSeries,totalsOk?v.page_views:0);
      if(!totalsOk)h+=sectionError('Översikt',totals,true);
      h+='<div class="svs-health"><div class="svs-metric svs-time-card"><div class="svs-time-pair"><div><div>Typisk tid</div><div class="v">'+(avgTime.ok?esc(secondsText(median)):'–')+'</div></div><div><div>Genomsnittlig tid</div><div class="v">'+(avgTime.ok?esc(secondsText(avg)):'–')+'</div></div></div><div class="svs-muted">Typisk tid är medianen: hälften av de uppmätta sidvisningarna var kortare och hälften längre. Genomsnittet påverkas mer av ovanligt långa besök.</div>'+(avgTime.ok?renderTimeDistribution(timeCheck):'<div class="svs-muted">Tidsstatistiken kunde inte hämtas just nu.</div>')+'</div><div class="svs-metric"><div>Besök som bara såg den här sidan</div><div class="v">'+(totalsOk?esc(percentText(pageBouncePct)):'–')+'</div><div class="svs-muted">'+(totalsOk?(num(v.entries)>0?esc(countOfText(v.bounces,v.entries))+' besök som började här avslutades utan att besökaren gick vidare till en annan sida.':'Inga besök började på sidan under perioden.'):'Översiktsstatistiken kunde inte hämtas just nu.')+'</div></div><div class="svs-metric"><div>Besök som slutade här</div><div class="v">'+(totalsOk?esc(percentText(pageExitPct)):'–')+'</div><div class="svs-muted">'+(totalsOk?(num(v.sessions)>0?esc(countOfText(v.exits,v.sessions))+' besök där sidan visades avslutades på den här sidan.':'Inga besök registrerades under perioden.'):'Översiktsstatistiken kunde inte hämtas just nu.')+'</div></div></div>';
      if(showInsights&&note)h+='<section class="svs-insight" aria-labelledby="svs-insight-title"><h3 id="svs-insight-title">Bra att veta</h3><strong>'+esc(note.title)+'</strong><p>'+esc(note.text)+'</p></section>';
      h+='<div class="svs-grid"><div>'+keyValueRows('Kommer från',sources,'source','page_views',6,friendlyTrafficSource)+flowRows('Föregående sida',previous,'previous_event_title','previous_event_url')+flowRows('Går vidare till',next,'next_event_title','next_event_url')+'</div><div>';
      if(showDevices)h+=devices.ok?renderBreakdown('Enheter',dev,'device_type','besök'):'<section class="svs-panel"><h3>Enheter</h3><p class="svs-muted">Enhetsstatistiken kunde inte hämtas just nu.</p></section>';
      if(showCountries)h+=countries.ok?renderBreakdown('Länder',cnt,'location_country_name','besök'):'<section class="svs-panel"><h3>Länder</h3><p class="svs-muted">Landsstatistiken kunde inte hämtas just nu.</p></section>';
      h+=renderReferrers(referrers);
      h+='</div></div>';
      h+=renderSearchConsole(gsc)+renderInternalSearch(internal)+(showCampaigns?renderCampaigns(campaigns,'Kampanjer som lett besökare till sidan'):'')+(showAiTraffic?renderAiTraffic(aiTraffic,'Besök från AI-tjänster'):'')+(showOutlinks?renderOutlinks(outlinks,'Externa länkar som besökare klickat på'):'')+(showDownloads?renderDownloads(downloads,'Filer som öppnats eller laddats ner från sidan'):'');
      if(currentException&&pageVariants){h+='<section class="svs-panel svs-wide svs-list-panel"><h3>Innehåll som visats på sidan</h3><p class="svs-muted">Sidan använder querystring för att visa olika innehåll. Varianterna redovisas separat utifrån de parametrar som har tillåtits i globala inställningar.</p>'+variantRowsHtml(pageVariantRows.slice(0,50))+'</section>';}
      if(pageUrl)h+='<p class="svs-muted svs-wide"><a class="svs-page-link" href="'+esc(pageUrl)+'" target="_blank" rel="noopener noreferrer">Öppna sidan i ny flik <span aria-hidden="true">↗</span></a></p>';
      if(diagnostics){
        var pageRenderMs=Date.now()-pageRenderStart;
        var pageRequestSoFarMs=Date.now()-requestStart;
        var pageAccountedMs=configMs+contextMs+branchCheckMs+originLookupMs+pageUrlMs+pageFilterMs+pageMainQueriesMs+pageComparisonMs+pageProcessingMs+pageRenderMs;
        var pageUnaccountedMs=Math.max(0,pageRequestSoFarMs-pageAccountedMs);
        h+='<details class="svs-diag"><summary>Teknisk diagnostik</summary><p>Läge: Denna sida</p><p>Sitevision-ID: '+esc(pg.id)+'</p><p>Piwik-URL: '+esc(pageUrl||'kunde inte identifieras')+'</p><h4>Tidsprofil för hela serverkedjan</h4><p>Inställningar och period: '+configMs+' ms</p><p>Aktuell sida, site och backend: '+contextMs+' ms</p><p>Kontroll om sidan har en gren: '+branchCheckMs+' ms</p><p>Identifiera webbplats-origin i Piwik: '+originLookupMs+' ms · '+(detectedOrigin?('HTTP '+detectedOrigin.statusCode):'ej frågad')+'</p><p>Identifiera sidans Piwik-URL: '+pageUrlMs+' ms'+(pageUrlResult?' · HTTP '+pageUrlResult.statusCode:'')+'</p><p>Bygga sidfilter: '+pageFilterMs+' ms</p><p>Piwik-frågor för aktuell sida: '+pageMainQueriesMs+' ms</p><p>Jämförelse mot hela webbplatsen: '+pageComparisonMs+' ms</p><p>Bearbeta statistikresultat: '+pageProcessingMs+' ms</p><p>Bygga HTML: '+pageRenderMs+' ms</p><p>Övrig uppmätt tid: '+pageUnaccountedMs+' ms</p><p><strong>Totalt hittills: '+pageRequestSoFarMs+' ms</strong></p><h4>Piwik-frågor</h4><p>Översikt: '+diagResult(totals)+'</p><p>Tidsserie: '+diagResult(pageSeries)+'</p><p>Ingångar / besök som bara såg sidan / utgångar: '+fmt(v.entries)+' / '+fmt(v.bounces)+' / '+fmt(v.exits)+'</p><p>Tid på sidan: '+diagResult(avgTime)+'</p><p>Kontroll tid · Piwik genomsnitt: '+esc(secondsText(avg))+' · median: '+esc(secondsText(median))+' · summa: '+esc(secondsText(sumTime))+' · summa / sidvisningar: '+esc(secondsText(num(v.page_views)?sumTime/num(v.page_views):0))+' · summa / unika sidvisningar: '+esc(secondsText(num(v.unique_page_views)?sumTime/num(v.unique_page_views):0))+'</p><p>Test utan sidtider över 10 min: '+(timeCheck.ok?esc(secondsText(timeCheck.cappedAverage))+' · '+fmt(timeCheck.longViews)+' av '+fmt(timeCheck.totalViews)+' sidvisningar hade tid över 10 min · längsta uppmätta tid '+esc(secondsText(timeCheck.maxSeconds)):'kunde inte beräknas')+'</p><p>Tidsfördelning: '+diagResult(timeDist)+'</p><p>Unika sidvisningar: '+fmt(v.unique_page_views)+'</p><p>Källor: '+diagResult(sources)+'</p><p>Enheter: '+diagResult(devices)+'</p><p>Länder: '+diagResult(countries)+'</p><p>Hänvisningar: '+diagResult(referrers)+'</p><p>Föregående: '+diagResult(previous)+'</p><p>Nästa: '+diagResult(next)+'</p><p>Search Console: '+(gsc?gsc.ms+' ms · HTTP '+gsc.statusCode:'ej frågad')+'</p><p>Intern sök: '+(internal?internal.ms+' ms · HTTP '+internal.statusCode:'ej frågad')+'</p><p>Filer: '+(downloads?downloads.ms+' ms · HTTP '+downloads.statusCode:'ej frågad')+'</p><p>Externa länkar: '+(outlinks?outlinks.ms+' ms · HTTP '+outlinks.statusCode:'ej frågad')+'</p><p>Kampanjer: '+(campaigns?campaigns.ms+' ms · HTTP '+campaigns.statusCode:'ej frågad')+'</p><p>AI-trafik: '+(aiTraffic?aiTraffic.ms+' ms · HTTP '+aiTraffic.statusCode:'ej frågad')+'</p><p>Jämförelse webbplats · enheter: '+(siteDevResult?siteDevResult.ms+' ms · HTTP '+siteDevResult.statusCode:'ej frågad')+'</p><p>Jämförelse webbplats · länder: '+(siteCntResult?siteCntResult.ms+' ms · HTTP '+siteCntResult.statusCode:'ej frågad')+'</p><p>Jämförelse webbplats · källor: '+(siteSrcResult?siteSrcResult.ms+' ms · HTTP '+siteSrcResult.statusCode:'ej frågad')+'</p><p>Nätverk för datakvalitet: '+(trafficQuality?trafficQuality.ms+' ms · HTTP '+trafficQuality.statusCode:'ej frågad')+'</p><p>Querystring-varianter: '+(pageVariants?pageVariants.ms+' ms · HTTP '+pageVariants.statusCode:'ej frågad')+'</p>'+countryDiagnostics(countries)+networkDiagnostics(trafficQuality)+'</details>';
      }
      return res.send(h+'</div>');
    }

    phaseStart=Date.now();
    var tree=collectBranch(isSiteRoot?site.sitePage:pg.node);if(!tree.ok)return res.send(css()+'<div class="svs"><div class="svs-error">'+esc(tree.error)+'</div></div>');
    var ids=[],names={},urls={};for(var i=0;i<tree.pages.length;i++){if(tree.pages[i].id){ids.push(tree.pages[i].id);names[tree.pages[i].id]=tree.pages[i].name;urls[tree.pages[i].id]=tree.pages[i].url;}}
    var treeMs=Date.now()-phaseStart;
    if(isSiteRoot&& !detectedOrigin.ok)return res.send(css()+'<div class="svs"><div class="svs-head"><div><h2 class="env-ui-text-heading">Besöksstatistik</h2><div class="svs-sub">Denna gren</div></div></div>'+modeControls(scope,d,canUseBranch)+dateControls(d,scope)+'<div class="svs-error"><strong>Webbplatsens statistik kunde inte avgränsas.</strong><p>Försök igen om en stund.</p></div></div>');
    // Startsidan representerar hela aktuell site och filtreras på dess Piwik-origin.
    // Vanliga grenar avgränsas alltid med Sitevision-ID:n. Det ger samma identitet
    // som sidläget och behåller historisk trafik även om en sida har bytt URL.
    var branchUrlMs=0,branchUrlResult=null;
    phaseStart=Date.now();
    var filter=isSiteRoot?siteUrlFilter(activeOrigin):branchIdFilter(ids);
    var eventScopeB=isSiteRoot?siteEventFilter(activeOrigin):branchEventFilter(ids);
    var filterMs=Date.now()-phaseStart;
    if(coreOnly){
      // Första steget ska vara litet och pålitligt. Det ger redaktören användbar statistik
      // även om någon sekundär Piwik-fråga tillfälligt blir långsam.
      var coreStart=Date.now();
      var coreTotals=query(rest,d,filter,[{column_id:'page_views'},{column_id:'sessions'},{column_id:'visitors'}],1,[]);
      var corePages=query(rest,d,filter,[{column_id:PAGE_ID_DIM},{column_id:'sessions'},{column_id:'visitors'},{column_id:'page_views'}],Math.min(Math.max(ids.length+50,100),1000),[[1,'desc']]);
      var coreV=coreTotals.ok?first(coreTotals):{},coreRows=corePages.ok?rows(corePages):[],coreMap={};
      for(i=0;i<coreRows.length;i++){var coreId=String(coreRows[i][PAGE_ID_DIM]||coreRows[i][PAGE_ID_DIM+'__label']||'');if(coreId)coreMap[coreId]={views:num(coreRows[i].page_views),sessions:num(coreRows[i].sessions),visitors:num(coreRows[i].visitors)};}
      var coreJoined=[];if(corePages.ok){for(i=0;i<ids.length;i++){var cm=coreMap[ids[i]]||{};coreJoined.push({id:ids[i],name:names[ids[i]]||ids[i],url:urls[ids[i]]||'',views:num(cm.views),sessions:num(cm.sessions),visitors:num(cm.visitors)});}coreJoined.sort(function(a,b){return b.views-a.views;});}
      var coreWith=corePages.ok?coreJoined.filter(function(x){return x.views>0;}):[],coreZero=corePages.ok?coreJoined.filter(function(x){return x.sessions===0;}):[];
      var coreHtml=css()+'<div class="svs"><div class="svs-head"><div><h2 class="env-ui-text-heading">Besöksstatistik</h2><div class="svs-sub">'+esc(pg.name||'Denna gren')+' · Denna gren</div></div><div class="svs-badge">'+esc(d.label)+'</div></div>'+modeControls(scope,d,canUseBranch)+dateControls(d,scope);
      coreHtml+='<div class="svs-metrics"><div class="svs-metric"><div>Sidvisningar</div><div class="v">'+(coreTotals.ok?fmt(coreV.page_views):'–')+'</div></div><div class="svs-metric"><div>Besök</div><div class="v">'+(coreTotals.ok?fmt(coreV.sessions):'–')+'</div></div><div class="svs-metric"><div>Unika besökare</div><div class="v">'+(coreTotals.ok?fmt(coreV.visitors):'–')+'</div></div></div>';
      coreHtml+='<div class="svs-health"><div class="svs-metric"><div>Publicerade sidor</div><div class="v">'+fmt(ids.length)+'</div></div><div class="svs-metric"><div>Sidor med visningar</div><div class="v">'+(corePages.ok?fmt(coreWith.length):'–')+'</div></div><div class="svs-metric"><div>0 besök</div><div class="v">'+(corePages.ok?fmt(coreZero.length):'–')+'</div></div></div>';
      if(corePages.ok&&showTopLists)coreHtml+='<div class="svs-grid"><div>'+progressive('Mest visade sidor',coreWith,initial,step,false)+'</div><div></div></div>';
      coreHtml+='<div class="svs-progressive-note" role="status">Grundstatistiken är klar. Länder, enheter och övriga delar hämtas fortfarande…</div>';
      if(diagnostics)coreHtml+='<details class="svs-diag"><summary>Teknisk diagnostik</summary><p>Progressiv laddning: grundstatistik</p><p>Översikt: '+diagResult(coreTotals)+'</p><p>Sidor: '+diagResult(corePages)+'</p><p>Grundsteget totalt: '+(Date.now()-coreStart)+' ms</p></details>';
      return res.send(coreHtml+'</div>');
    }
    var piwikMainStart=Date.now();
    // För länder och enheter använder jag besök som huvudmått. En crawler som laddar många
    // sidor under samma session ska inte kunna väga lika tungt som många riktiga besök.
    var branchSeries=timeSeriesQuery(rest,d,filter);
    var totalsB=query(rest,d,filter,[{column_id:'page_views'},{column_id:'sessions'},{column_id:'visitors'}],1,[]),pages=query(rest,d,filter,[{column_id:PAGE_ID_DIM},{column_id:'sessions'},{column_id:'visitors'},{column_id:'page_views'}],Math.min(Math.max(ids.length+50,100),1000),[[1,'desc']]),devicesB=query(rest,d,filter,[{column_id:'device_type'},{column_id:'sessions'},{column_id:'visitors'},{column_id:'page_views'}],20,[[1,'desc']]),countriesB=query(rest,d,filter,[{column_id:'location_country_name'},{column_id:'sessions'},{column_id:'visitors'},{column_id:'page_views'}],20,[[1,'desc']]),sourcesB=showInsights?query(rest,d,filter,[{column_id:'source'},{column_id:'page_views'}],20,[[1,'desc']]):null;
    var downloadsB=showDownloads?query(rest,d,eventScopeB,[{column_id:'download_url'},{column_id:'downloads'},{column_id:'unique_downloads'}],100,[[1,'desc']]):null;
    var outlinksB=showOutlinks?query(rest,d,eventScopeB,[{column_id:'outlink_url'},{column_id:'outlinks'},{column_id:'unique_outlinks'}],100,[[1,'desc']]):null;
    var campaignsB=showCampaigns?query(rest,d,filter,[{column_id:'campaign_name'},{column_id:'source'},{column_id:'medium'},{column_id:'sessions'},{column_id:'visitors'}],100,[[3,'desc']]):null;
    var aiTrafficB=showAiTraffic?query(rest,d,filter,[{column_id:'referrer_type'},{column_id:'source'},{column_id:'medium'},{column_id:'sessions'},{column_id:'visitors'}],100,[[3,'desc']]):null;
    var trafficQualityB=diagnostics?query(rest,d,filter,[{column_id:'location_country_name'},{column_id:'location_provider'},{column_id:'location_organization'},{column_id:'sessions'},{column_id:'visitors'},{column_id:'page_views'}],100,[[5,'desc']]):null;
    var branchExceptions=[];for(i=0;i<excludeSettings.queryExceptions.length;i++){for(var xi=0;xi<ids.length;xi++)if(ids[xi]===excludeSettings.queryExceptions[i].pageId){branchExceptions.push(excludeSettings.queryExceptions[i]);break;}}
    var variantResult=null,variantRows=[];if(branchExceptions.length){var vfilter=exceptionOnlyFilter(branchExceptions);if(vfilter){variantResult=query(rest,d,vfilter,[{column_id:PAGE_ID_DIM},{column_id:'event_url'},{column_id:'event_title'},{column_id:'sessions'},{column_id:'visitors'},{column_id:'page_views'}],1000,[[3,'desc']]);variantRows=exceptionVariants(variantResult,names);}}
    var piwikMainMs=Date.now()-piwikMainStart;
    var comparisonStart=Date.now();
    var siteDevices=null,siteCountries=null,siteSources=null;if(!isSiteRoot&&activeOrigin&&showInsights){var siteFilter=siteUrlFilter(activeOrigin);siteDevices=query(rest,d,siteFilter,[{column_id:'device_type'},{column_id:'sessions'},{column_id:'visitors'},{column_id:'page_views'}],20,[[1,'desc']]);siteCountries=query(rest,d,siteFilter,[{column_id:'location_country_name'},{column_id:'sessions'},{column_id:'visitors'},{column_id:'page_views'}],20,[[1,'desc']]);siteSources=query(rest,d,siteFilter,[{column_id:'source'},{column_id:'page_views'}],20,[[1,'desc']]);}
    var comparisonMs=Date.now()-comparisonStart;
    var processingStart=Date.now(),totalsBOk=!!totalsB.ok,pagesOk=!!pages.ok;
    var vb=totalsBOk?first(totalsB):{},pageRows=pagesOk?rows(pages):[],pageMap={};for(i=0;i<pageRows.length;i++){var id=String(pageRows[i][PAGE_ID_DIM]||pageRows[i][PAGE_ID_DIM+'__label']||'');if(id)pageMap[id]={views:num(pageRows[i].page_views),sessions:num(pageRows[i].sessions),visitors:num(pageRows[i].visitors)};}
    var baseJoined=[],joined=[];if(pagesOk){for(i=0;i<ids.length;i++){var pm=pageMap[ids[i]]||{},baseItem={id:ids[i],name:names[ids[i]]||ids[i],url:urls[ids[i]]||'',views:num(pm.views),sessions:num(pm.sessions),visitors:num(pm.visitors)};baseJoined.push(baseItem);var ex=queryExceptionForPage(ids[i]);if(ex&&variantRows.length){var added=false,sumViews=0,sumSessions=0,sumVisitors=0;for(var vi=0;vi<variantRows.length;vi++)if(variantRows[vi].id===ids[i]){joined.push(variantRows[vi]);sumViews+=num(variantRows[vi].views);sumSessions+=num(variantRows[vi].sessions);sumVisitors+=num(variantRows[vi].visitors);added=true;}if(added){var rv=Math.max(0,num(pm.views)-sumViews),rs=Math.max(0,num(pm.sessions)-sumSessions),ru=Math.max(0,num(pm.visitors)-sumVisitors);if(rv||rs||ru)joined.push({id:ids[i],name:names[ids[i]]||ids[i],url:urls[ids[i]]||'',views:rv,sessions:rs,visitors:ru});continue;}}joined.push(baseItem);}joined.sort(function(a,b){return b.views-a.views;});}
    var withViews=pagesOk?joined.filter(function(x){return x.views>0;}):[],baseWithViews=pagesOk?baseJoined.filter(function(x){return x.views>0;}):[],zero=pagesOk?baseJoined.filter(function(x){return x.sessions===0;}):[],lowTraffic=pagesOk?joined.filter(function(x){return x.sessions>0&&visitsPerWeek(x.sessions,d)<=2;}).sort(function(a,b){return a.sessions-b.sessions||a.views-b.views;}):[],devB=devicesB.ok?breakdown(devicesB,'device_type','sessions'):null,cntB=countriesB.ok?breakdown(countriesB,'location_country_name','sessions'):null,srcB=sourcesB&&sourcesB.ok?breakdown(sourcesB,'source','page_views'):null,siteDev=siteDevices&&siteDevices.ok?breakdown(siteDevices,'device_type','sessions'):(isSiteRoot?devB:null),siteCnt=siteCountries&&siteCountries.ok?breakdown(siteCountries,'location_country_name','sessions'):(isSiteRoot?cntB:null),siteSrc=siteSources&&siteSources.ok?breakdown(siteSources,'source'):(isSiteRoot?srcB:null),noteB=(totalsBOk&&pagesOk)?insight(devB,siteDev,cntB,siteCnt,srcB,siteSrc,withViews,zero,num(vb.page_views),ids.length,isSiteRoot):null;
    var branchQualityNote=countryTrafficQualityInsight(countriesB,num(vb.sessions),num(vb.page_views));if(branchQualityNote&&(!noteB||branchQualityNote.score>noteB.score))noteB=branchQualityNote;
    var processingMs=Date.now()-processingStart;
    var renderStart=Date.now();
    var hb=css()+'<div class="svs"><div class="svs-head"><div><h2 class="env-ui-text-heading">Besöksstatistik</h2><div class="svs-sub">'+esc(pg.name||'Denna gren')+' · Denna gren</div></div><div class="svs-badge">'+esc(d.label)+'</div></div>'+modeControls(scope,d,canUseBranch)+dateControls(d,scope)+reportActions();
    hb+='<div class="svs-metrics"><div class="svs-metric"><div>Sidvisningar</div><div class="v">'+(totalsBOk?fmt(vb.page_views):'–')+'</div><div class="svs-muted">Antal gånger sidor i grenen visades. Samma person kan stå för flera visningar.</div></div><div class="svs-metric"><div>Besök</div><div class="v">'+(totalsBOk?fmt(vb.sessions):'–')+'</div><div class="svs-muted">Antal besök där minst en sida i grenen ingick. Samma person kan göra flera besök.</div></div><div class="svs-metric"><div>Unika besökare</div><div class="v">'+(totalsBOk?fmt(vb.visitors):'–')+'</div><div class="svs-muted">Ungefärligt antal olika besökare som såg innehåll i grenen.</div></div></div>';
    hb+=renderTimeSeries(branchSeries,totalsBOk?vb.page_views:0);
    if(!totalsBOk)hb+=sectionError('Översikt',totalsB,true);
    hb+='<div class="svs-health"><div class="svs-metric"><div>Publicerade sidor</div><div class="v">'+fmt(ids.length)+'</div></div><div class="svs-metric"><div>Sidor med visningar</div><div class="v">'+(pagesOk?fmt(baseWithViews.length):'–')+'</div></div><div class="svs-metric'+(pagesOk&&highlightLowTraffic&&zero.length?' svs-metric-alert':'')+'"><div>0 besök</div><div class="v">'+(pagesOk?fmt(zero.length):'–')+'</div>'+(pagesOk&&highlightLowTraffic&&zero.length?'<div class="svs-muted">Sidor som kan vara värda att se över.</div>':(!pagesOk?'<div class="svs-muted">Sidvisningar per sida kunde inte hämtas.</div>':''))+'</div></div>';
    if(!pagesOk)hb+=sectionError('Sidlistor',pages,true);
    if(showInsights&&noteB)hb+='<section class="svs-insight" aria-labelledby="svs-insight-title"><h3 id="svs-insight-title">Bra att veta</h3><strong>'+esc(noteB.title)+'</strong><p>'+esc(noteB.text)+'</p></section>';
    hb+='<div class="svs-grid"><div>'+(pagesOk&&showTopLists?progressive('Mest visade sidor',withViews,initial,step,false)+lowTrafficList(lowTraffic,initial,step,d,!!branchQualityNote):'')+(pagesOk&&showZeroViews?progressive('Sidor utan registrerade besök',zero,initial,step,false):'')+'</div><div>';
    if(showDevices)hb+=devicesB.ok?renderBreakdown('Enheter',devB,'device_type','besök'):'<section class="svs-panel"><h3>Enheter</h3><p class="svs-muted">Enhetsstatistiken kunde inte hämtas just nu.</p></section>';
    if(showCountries)hb+=countriesB.ok?renderBreakdown('Länder',cntB,'location_country_name','besök'):'<section class="svs-panel"><h3>Länder</h3><p class="svs-muted">Landsstatistiken kunde inte hämtas just nu.</p></section>';hb+='</div></div>';
    if(showCampaigns)hb+=renderCampaigns(campaignsB,'Kampanjer som lett besökare till grenen');
    if(showAiTraffic)hb+=renderAiTraffic(aiTrafficB,'Besök från AI-tjänster');
    if(showOutlinks)hb+=renderOutlinks(outlinksB,'Mest klickade externa länkar i grenen');
    if(showDownloads)hb+=renderDownloads(downloadsB,'Mest använda filer i grenen');
    var renderMs=Date.now()-renderStart;
    if(diagnostics){
      var requestSoFarMs=Date.now()-requestStart;
      var knownPhaseMs=configMs+contextMs+branchCheckMs+originLookupMs+treeMs+branchUrlMs+filterMs+piwikMainMs+comparisonMs+processingMs+renderMs;
      var unaccountedMs=Math.max(0,requestSoFarMs-knownPhaseMs);
      hb+='<details class="svs-diag"><summary>Teknisk diagnostik</summary><p>Läge: Denna gren</p><p>Aktuell sida: '+esc(pg.id)+' · '+esc(pg.type)+'</p><p>Aktuell site: '+esc(site.siteName||site.siteId)+'</p><p>Piwik-filter: '+esc(isSiteRoot?('Aktuell site: '+activeOrigin):('Sitevision-ID:n i grenen, kompakt filter: '+ids.length))+'</p><p>Publicerade sid-ID:n: '+ids.length+'</p><h4>Tidsprofil för hela serverkedjan</h4><p>Inställningar och period: '+configMs+' ms</p><p>Aktuell sida, site och backend: '+contextMs+' ms</p><p>Kontroll om sidan har en gren: '+branchCheckMs+' ms</p><p>Identifiera webbplats-origin i Piwik: '+originLookupMs+' ms · '+(detectedOrigin?('HTTP '+detectedOrigin.statusCode):'ej frågad')+'</p><p>Läsa Sitevision-grenen: '+treeMs+' ms · '+tree.visited+' noder besökta</p><p>Identifiera grenens Piwik-URL: används inte</p><p>Bygga filter: '+filterMs+' ms</p><p>Piwik-frågor för aktuell gren: '+piwikMainMs+' ms</p><p>Jämförelse mot hela webbplatsen: '+comparisonMs+' ms</p><p>Bearbeta statistikresultat: '+processingMs+' ms</p><p>Bygga HTML: '+renderMs+' ms</p><p>Övrig uppmätt tid: '+unaccountedMs+' ms</p><p><strong>Totalt hittills: '+requestSoFarMs+' ms</strong></p><h4>Piwik-frågor</h4><p>Översikt: '+diagResult(totalsB)+'</p><p>Tidsserie: '+diagResult(branchSeries)+'</p><p>Sidor: '+diagResult(pages)+'</p><p>Enheter: '+diagResult(devicesB)+'</p><p>Länder: '+diagResult(countriesB)+'</p><p>Källor i grenen: '+(sourcesB?sourcesB.ms+' ms · HTTP '+sourcesB.statusCode:'ej frågad')+'</p><p>Filer: '+(downloadsB?downloadsB.ms+' ms · HTTP '+downloadsB.statusCode:'ej frågad')+'</p><p>Externa länkar: '+(outlinksB?outlinksB.ms+' ms · HTTP '+outlinksB.statusCode:'ej frågad')+'</p><p>Kampanjer: '+(campaignsB?campaignsB.ms+' ms · HTTP '+campaignsB.statusCode:'ej frågad')+'</p><p>AI-trafik: '+(aiTrafficB?aiTrafficB.ms+' ms · HTTP '+aiTrafficB.statusCode:'ej frågad')+'</p><p>Nätverk för datakvalitet: '+(trafficQualityB?trafficQualityB.ms+' ms · HTTP '+trafficQualityB.statusCode:'ej frågad')+'</p><p>Querystring-varianter: '+(variantResult?variantResult.ms+' ms · HTTP '+variantResult.statusCode:'ej frågad')+'</p><p>Jämförelse webbplats · enheter: '+(siteDevices?siteDevices.ms+' ms · HTTP '+siteDevices.statusCode:'ej frågad')+'</p><p>Jämförelse webbplats · länder: '+(siteCountries?siteCountries.ms+' ms · HTTP '+siteCountries.statusCode:'ej frågad')+'</p><p>Jämförelse webbplats · källor: '+(siteSources?siteSources.ms+' ms · HTTP '+siteSources.statusCode:'ej frågad')+'</p>'+countryDiagnostics(countriesB)+networkDiagnostics(trafficQualityB)+'<p>PageID-dimension: '+esc(PAGE_ID_DIM)+'</p><p>Filter: printable '+(excludeSettings.printable?'på':'av')+', querystring '+(excludeSettings.queryString?'på':'av')+', inloggad '+(excludeSettings.inloggad?'på':'av')+', systemdelar '+(excludeSettings.systemParts?'på':'av')+', egna mönster '+excludeSettings.customPatterns.length+', querystring-undantag '+excludeSettings.queryExceptions.length+'</p></details>';
    }
    return res.send(hb+'</div>');
  }

  // Jag håller root-routen medvetet liten. Tidigare väntade Sitevision på alla
  // Piwik-frågor innan något kunde visas. Nu får redaktören laddningsstatus
  // direkt och den tunga hämtningen körs separat i /statistics.
  router.get('/',function(req,res){
    try{
      var configQuery=localConfigQuery(globalAppData);
      return res.agnosticRender('',{configQuery:configQuery||''});
    }catch(error){
      logError('Root-rendering misslyckades.',error);
      return res.agnosticRender('',{configQuery:'',startupError:true});
    }
  });

  // Samma statistikmotor som i den stabila 1.5.9-versionen körs här.
  // Det gör att vi kan ändra laddningsflödet utan att samtidigt skriva om
  // den Piwik-logik som redan är testad.
  function handleStatistics(req,res,coreOnly){
    var requestStart=Date.now();
    try{
      var result=renderStatistics(req,res,coreOnly===true);
      var duration=Date.now()-requestStart;
      if(duration>=15000)logWarn((coreOnly?'Långsam grundstatistikbegäran: ':'Långsam statistikbegäran: ')+duration+' ms.');
      else logDebug((coreOnly?'Grundstatistikbegäran':'Statistikbegäran')+' klar på '+duration+' ms.');
      return result;
    }catch(error){
      logError(coreOnly?'Oväntat fel i grundstatistikbegäran.':'Oväntat fel i statistikbegäran.',error);
      return res.status(500).send('<div class="svs"><div class="svs-error" role="alert"><strong>Statistiken kunde inte hämtas.</strong><p>Försök igen. Om problemet kvarstår kan en administratör kontrollera Sitevisions applogg.</p></div></div>');
    }
  }

  router.get('/statistics/core',function(req,res){
    return handleStatistics(req,res,true);
  });

  router.get('/statistics',function(req,res){
    return handleStatistics(req,res,false);
  });