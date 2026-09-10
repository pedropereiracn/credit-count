#!/usr/bin/env python3
"""Gera 0006_seed.sql a partir da lista verificada, e CONTA em vez de afirmar.

O arquivo `seed-coasters.md` dizia 44 coasters, 9 parques e 11 fabricantes.
Contando a propria lista dele: nao bate. Por isso este script existe, e por isso
os numeros do TDD saem daqui e nao da memoria de ninguem.
"""
import collections

# (coaster, parque, fabricante ou None, tipo)
D = [
 # Reino Unido
 ("Nemesis Reborn","Alton Towers","Bolliger & Mabillard","steel"),
 ("Oblivion","Alton Towers","Bolliger & Mabillard","steel"),
 ("The Smiler","Alton Towers","Gerstlauer","steel"),
 ("Wicker Man","Alton Towers","Great Coasters International","wooden"),
 ("Rita","Alton Towers","Intamin","steel"),
 ("Th13teen","Alton Towers","Intamin","steel"),
 ("Stealth","Thorpe Park","Intamin","steel"),
 ("Nemesis Inferno","Thorpe Park","Bolliger & Mabillard","steel"),
 ("Colossus","Thorpe Park","Intamin","steel"),
 ("The Swarm","Thorpe Park","Bolliger & Mabillard","steel"),
 ("Hyperia","Thorpe Park","Mack Rides","steel"),
 ("The Big One","Blackpool Pleasure Beach","Arrow Dynamics","steel"),
 ("Icon","Blackpool Pleasure Beach","Mack Rides","steel"),
 ("Grand National","Blackpool Pleasure Beach","Charles Paige","wooden"),
 ("Big Dipper","Blackpool Pleasure Beach","John A. Miller","wooden"),
 ("Mandrill Mayhem","Chessington World of Adventures","Vekoma","steel"),
 ("Vampire","Chessington World of Adventures","Arrow Dynamics","steel"),
 # Estados Unidos
 ("The Incredible Hulk Coaster","Universal Islands of Adventure","Bolliger & Mabillard","steel"),
 ("Jurassic World VelociCoaster","Universal Islands of Adventure","Intamin","steel"),
 ("Hagrid's Magical Creatures Motorbike Adventure","Universal Islands of Adventure","Intamin","steel"),
 ("Hollywood Rip Ride Rockit","Universal Studios Florida","Maurer Rides","steel"),
 ("Revenge of the Mummy","Universal Studios Florida","Premier Rides","steel"),
 ("Stardust Racers","Universal Epic Universe","Mack Rides","steel"),
 ("Curse of the Werewolf","Universal Epic Universe","Mack Rides","steel"),
 ("Hiccup's Wing Gliders","Universal Epic Universe","Intamin","steel"),
 ("Mine-Cart Madness","Universal Epic Universe","Intamin","steel"),
 ("Mako","SeaWorld Orlando","Bolliger & Mabillard","steel"),
 ("Manta","SeaWorld Orlando","Bolliger & Mabillard","steel"),
 ("Kraken","SeaWorld Orlando","Bolliger & Mabillard","steel"),
 ("Ice Breaker","SeaWorld Orlando","Premier Rides","steel"),
 ("Pipeline: The Surf Coaster","SeaWorld Orlando","Bolliger & Mabillard","steel"),
 ("Iron Gwazi","Busch Gardens Tampa Bay","Rocky Mountain Construction","hybrid"),
 ("SheiKra","Busch Gardens Tampa Bay","Bolliger & Mabillard","steel"),
 ("Montu","Busch Gardens Tampa Bay","Bolliger & Mabillard","steel"),
 ("Kumba","Busch Gardens Tampa Bay","Bolliger & Mabillard","steel"),
 ("Cheetah Hunt","Busch Gardens Tampa Bay","Intamin","steel"),
 ("Skyrush","Hersheypark","Intamin","steel"),
 ("Candymonium","Hersheypark","Bolliger & Mabillard","steel"),
 ("Wildcat's Revenge","Hersheypark","Rocky Mountain Construction","hybrid"),
 ("Great Bear","Hersheypark","Bolliger & Mabillard","steel"),
 ("Storm Runner","Hersheypark","Intamin","steel"),
 ("Fahrenheit","Hersheypark","Intamin","steel"),
 ("Lightning Racer","Hersheypark","Great Coasters International","wooden"),
 ("Comet","Hersheypark","Philadelphia Toboggan Coasters","wooden"),
 ("Laff Trakk","Hersheypark","Maurer Rides","steel"),
 ("Sooperdooperlooper","Hersheypark","Schwarzkopf","steel"),
]

PAIS = {p:"GB" for p in ["Alton Towers","Thorpe Park","Blackpool Pleasure Beach",
                         "Chessington World of Adventures"]}
PAIS.update({p:"US" for p in ["Universal Islands of Adventure","Universal Studios Florida",
                              "Universal Epic Universe","SeaWorld Orlando",
                              "Busch Gardens Tampa Bay","Hersheypark"]})

parques  = sorted({p for _,p,_,_ in D})
fabs     = sorted({f for _,_,f,_ in D if f})
tipos    = sorted({t for _,_,_,t in D})
paises   = sorted(set(PAIS.values()))
assert all(p in PAIS for p in parques), "parque sem pais"
assert len({(p, c.lower()) for c,p,_,_ in D}) == len(D), "coaster duplicado no mesmo parque"

def q(x): return "'" + x.replace("'","''") + "'"

L = []
L.append("-- 0006_seed.sql  Catalogo semente, gerado por gerar_seed.py. Nao editar a mao.")
L.append("--")
L.append(f"-- {len(D)} montanhas-russas reais, {len(parques)} parques, {len(fabs)} fabricantes,")
L.append(f"-- {len(tipos)} tipos de trilho, {len(paises)} paises. O SOW 6 pede 'roughly 30 to 50'.")
L.append("--")
L.append("-- Roda como dono do banco (migration), entao a RLS nao atrapalha. Nenhum cliente")
L.append("-- consegue fazer estes inserts: as politicas de catalogo exigem is_admin().")
L.append("")
L.append("insert into public.parks (name, country_code) values")
L.append(",\n".join(f"  ({q(p)}, {q(PAIS[p])})" for p in parques) + ";")
L.append("")
L.append("insert into public.manufacturers (name) values")
L.append(",\n".join(f"  ({q(f)})" for f in fabs) + ";")
L.append("")
L.append("insert into public.coasters (name, park_id, manufacturer_id, track_type) values")
linhas = []
for c,p,f,t in D:
    m = f"(select id from public.manufacturers where name = {q(f)})" if f else "null"
    linhas.append(f"  ({q(c)},\n     (select id from public.parks where name = {q(p)}),\n     {m},\n     {q(t)})")
L.append(",\n".join(linhas) + ";")
L.append("")
L.append("-- conferencia: se a contagem nao bater, o build para aqui")
L.append("do $$ begin")
L.append(f"  if (select count(*) from public.coasters) <> {len(D)} then")
L.append(f"    raise exception 'seed: esperava {len(D)} coasters, achei %', (select count(*) from public.coasters);")
L.append("  end if;")
L.append(f"  if (select count(*) from public.parks) <> {len(parques)} then")
L.append("    raise exception 'seed: contagem de parques errada';")
L.append("  end if;")
L.append(f"  if (select count(*) from public.manufacturers) <> {len(fabs)} then")
L.append("    raise exception 'seed: contagem de fabricantes errada';")
L.append("  end if;")
L.append("end $$;")
open("0006_seed.sql","w").write("\n".join(L) + "\n")

print(f"coasters      {len(D)}")
print(f"parques       {len(parques)}  ({sum(1 for p in parques if PAIS[p]=='GB')} GB, {sum(1 for p in parques if PAIS[p]=='US')} US)")
print(f"fabricantes   {len(fabs)}")
print(f"tipos         {len(tipos)}  {dict(collections.Counter(t for *_,t in D))}")
print(f"paises        {len(paises)}  {dict(collections.Counter(PAIS[p] for _,p,_,_ in D))}")
print("\nfabricantes:", ", ".join(fabs))
