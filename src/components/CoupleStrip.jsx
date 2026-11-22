import { useEffect, useRef, useState } from 'react';
import { hora, inicioDoDia, mesmoDia, MIN } from '../lib/dates.js';

const INICIO_H = 7;
const FIM_H = 24;
const MARCAS = [8, 12, 16, 20];

// junta blocos que se encostam ou se sobrepõem
function mesclar(blocos) {
  const ord = blocos.slice().sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const [a, b] of ord) {
    const u = out[out.length - 1];
    if (u && a <= u[1]) u[1] = Math.max(u[1], b);
    else out.push([a, b]);
  }
  return out;
}

const faixaDe = (ev) => [new Date(ev.inicio).getTime(), new Date(ev.fim).getTime()];
const sobrepoe = ([a, b], [c, d]) => a < d && c < b;

/**
 * Faixa do casal: duas linhas finas cobrindo o dia (7h à meia-noite).
 * Os traços são os horários ocupados de cada um; o verde entre as linhas
 * mostra quando os dois estão livres. Passe o mouse (ou toque) num traço
 * para ver o que é; toque no verde para marcar algo juntos.
 */
export default function CoupleStrip({ dia, eu, par, ocupados, livres, eventos, ehCompartilhado, onMarcar }) {
  const [agora, setAgora] = useState(() => new Date());
  const [balao, setBalao] = useState(null); // { chave, pct, titulo, itens, livre? }
  const area = useRef(null);

  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // no celular: tocar fora fecha o balão
  useEffect(() => {
    if (!balao) return;
    const fechar = (e) => area.current && !area.current.contains(e.target) && setBalao(null);
    document.addEventListener('pointerdown', fechar);
    return () => document.removeEventListener('pointerdown', fechar);
  }, [balao]);

  useEffect(() => setBalao(null), [dia.getTime()]);

  const ini = inicioDoDia(dia).getTime() + INICIO_H * 60 * MIN;
  const fim = inicioDoDia(dia).getTime() + FIM_H * 60 * MIN;
  const total = fim - ini;
  const pct = (t) => ((Math.min(Math.max(t, ini), fim) - ini) / total) * 100;
  const larg = (a, b) => `${pct(b) - pct(a)}%`;

  const blocosDe = (userId) =>
    mesclar(
      ocupados
        .filter((o) => o.user_id === userId)
        .map(faixaDe)
        .filter(([a, b]) => a < fim && b > ini)
    );

  const comHora = eventos.filter((e) => !e.dia_inteiro);

  // o que existe dentro de um traço ocupado
  function itensDoBloco(bloco, quem) {
    if (quem === 'eu') {
      return comHora.filter((e) => sobrepoe(faixaDe(e), bloco)).map((e) => ({ id: e.id, quando: `${hora(e.inicio)}–${hora(e.fim)}`, titulo: e.titulo }));
    }
    // do par: só os eventos compartilhados têm título; o resto é pessoal dele(a)
    const compartilhados = comHora.filter((e) => ehCompartilhado(e) && sobrepoe(faixaDe(e), bloco));
    const itens = compartilhados.map((e) => ({ id: e.id, quando: `${hora(e.inicio)}–${hora(e.fim)}`, titulo: e.titulo }));
    const coberto = mesclar(compartilhados.map(faixaDe));
    const tudoCoberto = coberto.some(([a, b]) => a <= bloco[0] && b >= bloco[1]);
    if (!tudoCoberto) itens.push({ id: 'pessoal', quando: `${hora(bloco[0])}–${hora(bloco[1])}`, titulo: 'Compromisso pessoal', privado: true });
    return itens;
  }

  function abrir(chave, meio, titulo, itens, extra = {}) {
    setBalao({ chave, pct: meio, titulo, itens, ...extra });
  }

  const linhas = [
    { quem: 'eu', pessoa: eu, blocos: blocosDe(eu.id), classe: 'cf-t1' },
    { quem: 'par', pessoa: par, blocos: blocosDe(par.id), classe: 'cf-t2' },
  ];

  const livresDoDia = livres.filter((l) => mesmoDia(new Date(l.inicio), dia));
  const mostraAgora = mesmoDia(dia, agora) && agora.getTime() > ini && agora.getTime() < fim;

  // o maior horário livre do dia, para a frase embaixo
  const melhor = livresDoDia.reduce((m, l) => (!m || l.fim - l.inicio > m.fim - m.inicio ? l : m), null);
  const descricao = melhor
    ? `Vocês estão livres das ${hora(melhor.inicio)} às ${hora(melhor.fim)}`
    : 'Vocês não têm um horário livre juntos neste dia';

  // posição do balão: centralizado, mas sem sair pelas bordas
  const alinhamento = balao ? (balao.pct < 18 ? 'esq' : balao.pct > 82 ? 'dir' : 'meio') : '';

  return (
    <section className="casal-faixa" aria-label={`Dia de vocês dois. ${descricao}.`}>
      <div className="cf-grade">
        <div className="cf-nomes" aria-hidden="true">
          <span style={{ '--cor': eu.cor }} title={eu.nome}>{eu.inicial}</span>
          <span style={{ '--cor': par.cor }} title={par.nome}>{par.inicial}</span>
        </div>

        <div className="cf-area" ref={area} onPointerLeave={(e) => e.pointerType === 'mouse' && setBalao(null)}>
          {livresDoDia.map((l) => {
            const a = l.inicio.getTime();
            const b = l.fim.getTime();
            const chave = `livre-${a}`;
            return (
              <button
                key={chave}
                className={`cf-livre ${balao?.chave === chave ? 'ativo' : ''}`}
                style={{ left: `${pct(a)}%`, width: larg(a, b) }}
                onPointerEnter={(e) =>
                  e.pointerType === 'mouse' && abrir(chave, (pct(a) + pct(b)) / 2, `Livres das ${hora(l.inicio)} às ${hora(l.fim)}`, [], { livre: true })
                }
                onClick={() => onMarcar(l)}
                aria-label={`Livres juntos das ${hora(l.inicio)} às ${hora(l.fim)}. Marcar algo.`}
              >
                <span className="cf-mais" aria-hidden="true">+</span>
              </button>
            );
          })}

          {linhas.map(({ quem, pessoa, blocos, classe }) => (
            <div key={quem} className={`cf-trilho ${classe}`} style={{ '--cor': pessoa.cor }}>
              {blocos.map((bloco) => {
                const [a, b] = bloco;
                const chave = `${quem}-${a}`;
                const mostrar = () => abrir(chave, (pct(a) + pct(b)) / 2, quem === 'eu' ? 'Você' : pessoa.nome, itensDoBloco(bloco, quem));
                return (
                  <button
                    key={chave}
                    className={`cf-bloco ${balao?.chave === chave ? 'ativo' : ''}`}
                    style={{ left: `${pct(a)}%`, width: larg(a, b) }}
                    onPointerEnter={(e) => e.pointerType === 'mouse' && mostrar()}
                    onClick={() => (balao?.chave === chave ? setBalao(null) : mostrar())}
                    aria-label={`${quem === 'eu' ? 'Você' : pessoa.nome} ocupado das ${hora(a)} às ${hora(b)}`}
                  />
                );
              })}
            </div>
          ))}

          {mostraAgora && <span className="cf-agora" style={{ left: `${pct(agora.getTime())}%` }} />}

          <div className="cf-horas" aria-hidden="true">
            {MARCAS.map((h) => (
              <span key={h} style={{ left: `${pct(inicioDoDia(dia).getTime() + h * 60 * MIN)}%` }}>{h}h</span>
            ))}
          </div>

          {balao && (
            <div className={`cf-balao ${alinhamento} ${balao.livre ? 'livre' : ''}`} style={{ left: `${balao.pct}%` }} role="tooltip">
              <strong>{balao.titulo}</strong>
              {balao.livre ? (
                <span className="cf-balao-dica">Clique para marcar algo juntos</span>
              ) : (
                <ul>
                  {balao.itens.map((it) => (
                    <li key={it.id} className={it.privado ? 'privado' : ''}>
                      <span>{it.quando}</span> {it.titulo}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="cf-rodape">
        <span className={melhor ? '' : 'cf-sem'}>{descricao}</span>
        {melhor && (
          <button className="cf-marcar" onClick={() => onMarcar(melhor)}>
            Marcar algo
          </button>
        )}
      </div>
    </section>
  );
}
