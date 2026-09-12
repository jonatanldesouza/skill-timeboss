'use strict';

/**
 * schedule.js
 * ----------------------------------------------------------------------------
 * Snapshot (fallback) da tabela "Time Boss" do TioLeoBPT.
 *
 * FONTE DE VERDADE (atualizada todo dia pelo Tio Leo):
 *   https://tioleobpt.com.br/js/script3.js  ->  objeto `fallbackServers`
 *
 * O site republica esse arquivo diariamente com novos minutos. O
 * `datasource.js` baixa esse arquivo e, se falhar, usa este snapshot.
 *
 * Snapshot capturado em: 2026-09-12 (script3.js?v=1789195036)
 * Estrutura: { Servidor: { Time: "minuto" } }
 * ----------------------------------------------------------------------------
 */

const FALLBACK_SERVERS = {
  Awell: { Gama: '17', Beta: '36', Alfa: '29', Delta: '17', Omega: '02', Zeta: '35' },
  Migal: { Gama: '40', Beta: '31', Alfa: '20', Delta: '17', Omega: '02', Zeta: '35' },
  Midranda: { Gama: '19', Beta: '28', Alfa: '44', Delta: '14', Omega: '02', Zeta: '35' },
  Cronus: { Gama: '15', Beta: '36', Alfa: '33', Delta: '05' },
  Idhas: { Gama: '11', Beta: '20', Alfa: '11' },
};

/** Ordem oficial dos servidores exibida no site. */
const SERVER_ORDER = ['Awell', 'Migal', 'Midranda', 'Cronus', 'Idhas'];

/** Ordem oficial dos times (usada apenas para desempate/estabilidade). */
const TEAM_ORDER = ['Omega', 'Gama', 'Delta', 'Alfa', 'Zeta', 'Beta'];

/** Data do snapshot acima (usada na mensagem de fallback). */
const FALLBACK_DATE = '2026-09-12';

module.exports = {
  FALLBACK_SERVERS,
  SERVER_ORDER,
  TEAM_ORDER,
  FALLBACK_DATE,
};
