import collections

# --- Klasa reprezentująca graf ---
class Graph:
    """
    Klasa reprezentująca graf za pomocą listy sąsiedztwa.
    Obsługuje grafy skierowane/nieskierowane oraz ważone/nieważone.
    Wierzchołki są indeksowane od 0 do num_vertices - 1.
    """
    def __init__(self, num_vertices, directed=False, weighted=False):
        self.num_vertices = num_vertices
        self.adj = collections.defaultdict(list) # Lista sąsiedztwa: {u: [(v, weight), ...]}
        self.directed = directed
        self.weighted = weighted
        self.edges_list = [] # Lista wszystkich krawędzi (u, v, weight)

    def add_edge(self, u, v, weight=1):
        """
        Dodaje krawędź do grafu.
        Dla grafów nieważonych 'weight' jest domyślnie 1.
        """
        self.adj[u].append((v, weight))
        self.edges_list.append((u, v, weight))
        if not self.directed:
            self.adj[v].append((u, weight))
            # Dla nieskierowanych, dodajemy tylko raz do globalnej listy krawędzi,
            # aby uniknąć duplikatów w algorytmach typu Kruskal.
            # W `adj` duplikat jest ok, bo to połączenie w drugą stronę.

    def get_neighbors(self, u):
        """Zwraca listę sąsiadów wierzchołka u wraz z wagami."""
        return self.adj[u]

    def get_all_edges(self):
        """Zwraca listę wszystkich krawędzi w formacie (u, v, weight).
           Dla grafów nieskierowanych każda krawędź występuje raz."""
        if self.directed:
            return self.edges_list
        else:
            # Dla grafów nieskierowanych musimy usunąć duplikaty (u,v) i (v,u)
            # Używamy zbioru krotek (min(u,v), max(u,v), weight) aby zapewnić unikalność
            unique_edges = set()
            for u, v, weight in self.edges_list:
                unique_edges.add(tuple(sorted((u, v))) + (weight,))
            return [ (edge[0], edge[1], edge[2]) for edge in unique_edges]


    @staticmethod
    def load_from_file(filename):
        """
        Wczytuje graf z pliku tekstowego.
        Format pliku:
        Pierwsza linia: num_vertices is_directed is_weighted
        Kolejne linie: u v [weight] (dla każdej krawędzi)
        """
        try:
            with open(filename, 'r') as f:
                lines = f.readlines()

            # Pomiń linie komentarza
            data_lines = [line.strip() for line in lines if not line.strip().startswith('#') and line.strip()]

            if not data_lines:
                raise ValueError("Plik grafu jest pusty lub zawiera tylko komentarze.")

            # Pierwsza linia: num_vertices is_directed is_weighted
            header = list(map(int, data_lines[0].split()))
            if len(header) < 3:
                raise ValueError("Nieprawidłowy nagłówek pliku grafu. Oczekiwano: num_vertices is_directed is_weighted")
            
            num_vertices, is_directed, is_weighted = header

            graph = Graph(num_vertices, bool(is_directed), bool(is_weighted))

            # Kolejne linie: krawędzie
            for line in data_lines[1:]:
                parts = list(map(int, line.split()))
                if graph.weighted:
                    if len(parts) != 3:
                        raise ValueError(f"Nieprawidłowy format krawędzi w linii: '{line}'. Oczekiwano: u v weight.")
                    u, v, weight = parts
                    graph.add_edge(u, v, weight)
                else:
                    if len(parts) < 2 or len(parts) > 3: # allow 3 parts for non-weighted if weight is present but ignored
                        raise ValueError(f"Nieprawidłowy format krawędzi w linii: '{line}'. Oczekiwano: u v.")
                    u, v = parts[0], parts[1]
                    graph.add_edge(u, v)
            return graph
        except FileNotFoundError:
            print(f"Błąd: Plik '{filename}' nie został znaleziony.")
            return None
        except ValueError as e:
            print(f"Błąd podczas parsowania pliku grafu: {e}")
            return None
        except Exception as e:
            print(f"Wystąpił nieznany błąd podczas wczytywania grafu: {e}")
            return None


# --- Stałe do kolorów wierzchołków ---
WHITE = 0 # Nieodwiedzony
GRAY = 1  # Odkryty, w trakcie przetwarzania (na stosie rekurencji)
BLACK = 2 # Przetworzony


# --- Algorytm Przeszukiwania w Głąb (DFS) ---

def dfs_visit(graph, u, colors, d_times, f_times, predecessors, current_time, steps_log, edge_types=None, component_id=None, current_component_nodes=None, dfs_stack=None):
    """
    Pomocnicza funkcja rekurencyjna DFS-WIZYTA.
    """
    if dfs_stack is None:
        dfs_stack = []

    colors[u] = GRAY
    current_time[0] += 1
    d_times[u] = current_time[0]
    steps_log.append(f"Odwiedzam wierzchołek {u}. Czas odkrycia d[{u}] = {d_times[u]}. Kolor {u}: SZARY.")
    dfs_stack.append(u)
    steps_log.append(f"Stos rekurencji: {list(dfs_stack)}")

    if component_id is not None and current_component_nodes is not None:
        current_component_nodes.append(u)

    # Sortowanie sąsiadów dla powtarzalności wyników, jeśli to nie jest istotą testu
    # (np. w zależności od wyboru sąsiadów wynik DFS może się różnić)
    sorted_neighbors = sorted(graph.get_neighbors(u), key=lambda x: x[0])

    for v, _ in sorted_neighbors:
        if edge_types is not None:
            if colors[v] == WHITE:
                edge_types[(u, v)] = "DRZEWOWA" # Krawędź drzewowa
                steps_log.append(f"Analizuję krawędź ({u}, {v}). Wierzchołek {v} jest BIAŁY. Klasyfikuję jako DRZEWOWĄ.")
                predecessors[v] = u
                dfs_visit(graph, v, colors, d_times, f_times, predecessors, current_time, steps_log, edge_types, component_id, current_component_nodes, dfs_stack)
            elif colors[v] == GRAY:
                edge_types[(u, v)] = "POWROTNA" # Krawędź powrotna (cykl w grafie skierowanym)
                steps_log.append(f"Analizuję krawędź ({u}, {v}). Wierzchołek {v} jest SZARY. Klasyfikuję jako POWROTNĄ (cykl!).")
                edge_types['has_back_edge'] = True # Flaga do wykrywania cykli
            elif colors[v] == BLACK:
                if d_times[u] < d_times[v]:
                    edge_types[(u, v)] = "W PRZÓD" # Krawędź w przód
                    steps_log.append(f"Analizuję krawędź ({u}, {v}). Wierzchołek {v} jest CZARNY. d[{u}]={d_times[u]}, d[{v}]={d_times[v]}. Klasyfikuję jako W PRZÓD.")
                else:
                    edge_types[(u, v)] = "POPRZECZNA" # Krawędź poprzeczna
                    steps_log.append(f"Analizuję krawędź ({u}, {v}). Wierzchołek {v} jest CZARNY. d[{u}]={d_times[u]}, d[{v}]={d_times[v]}. Klasyfikuję jako POPRZECZNĄ.")
        else:
            if colors[v] == WHITE:
                steps_log.append(f"Analizuję krawędź ({u}, {v}). Wierzchołek {v} jest BIAŁY. Kontynuuję DFS.")
                predecessors[v] = u
                dfs_visit(graph, v, colors, d_times, f_times, predecessors, current_time, steps_log, edge_types, component_id, current_component_nodes, dfs_stack)
            else:
                steps_log.append(f"Analizuję krawędź ({u}, {v}). Wierzchołek {v} już odwiedzony (kolor {['BIAŁY','SZARY','CZARNY'][colors[v]]}).")

    dfs_stack.pop()
    colors[u] = BLACK
    current_time[0] += 1
    f_times[u] = current_time[0]
    steps_log.append(f"Kończę przetwarzanie wierzchołka {u}. Czas zakończenia f[{u}] = {f_times[u]}. Kolor {u}: CZARNY.")
    steps_log.append(f"Stos rekurencji: {list(dfs_stack)}")

    # Dodatkowe działanie dla sortowania topologicznego
    if 'topo_list' in steps_log and steps_log['topo_list'] is not None:
        steps_log['topo_list'].insert(0, u) # Wstaw na początek listy
        steps_log.append(f"Dodaję {u} do listy sortowania topologicznego. Aktualna lista: {steps_log['topo_list']}")


def run_dfs(graph, start_node, full_search=False, classify=False, topological_sort_mode=False):
    """
    Funkcja główna do uruchamiania DFS (zadania 1, 2, 3, 4).
    start_node: Wierzchołek startowy dla pojedynczego DFS. Ignorowany w trybie full_search.
    full_search: True dla pełnego przeszukiwania (DFS-PEŁNY).
    classify: True dla klasyfikacji krawędzi. Wymaga grafu skierowanego.
    topological_sort_mode: True dla sortowania topologicznego. Wymaga grafu skierowanego.
    """
    num_vertices = graph.num_vertices
    colors = [WHITE] * num_vertices
    d_times = [None] * num_vertices # Czas odkrycia
    f_times = [None] * num_vertices # Czas zakończenia przetwarzania
    predecessors = [None] * num_vertices
    current_time = [0] # Używamy listy do przekazywania czasu przez referencję
    steps_log = [] # Lista do przechowywania kroków algorytmu
    
    edge_types = {} if classify else None
    
    if topological_sort_mode:
        if not graph.directed:
            print("Błąd: Sortowanie topologiczne wymaga grafu skierowanego.")
            return None, None, None, None, None
        steps_log['topo_list'] = [] # Dodatkowa lista do przechowywania wyniku sortowania

    dfs_trees = [] # Dla pełnego DFS
    num_dfs_visits = 0 # Liczba uruchomień DFS-WIZYTA

    if not full_search:
        steps_log.append(f"\n--- Uruchamiam DFS z wierzchołka startowego: {start_node} ---")
        num_dfs_visits += 1
        dfs_visit(graph, start_node, colors, d_times, f_times, predecessors, current_time, steps_log, edge_types)
        dfs_trees.append({node for node in range(num_vertices) if colors[node] != WHITE})
    else:
        steps_log.append("\n--- Uruchamiam pełne przeszukiwanie DFS (DFS-PEŁNY) ---")
        for u in range(num_vertices):
            if colors[u] == WHITE:
                steps_log.append(f"\nRozpoczynam nowe drzewo DFS z wierzchołka {u}.")
                num_dfs_visits += 1
                current_component_nodes = []
                dfs_visit(graph, u, colors, d_times, f_times, predecessors, current_time, steps_log, edge_types, component_id=len(dfs_trees), current_component_nodes=current_component_nodes)
                dfs_trees.append(current_component_nodes)
    
    # --- Wypisanie wyników ---
    print("\n" + "="*50)
    print("--- DETALICZNY PRZEBIEG ALGORYTMU DFS ---")
    print("="*50)
    for step in steps_log:
        if isinstance(step, str): # Odfiltrowuje 'topo_list' jeśli jest jako słownik
            print(step)
    
    print("\n" + "="*50)
    print("--- PODSUMOWANIE WYNIKÓW DFS ---")
    print("="*50)
    print("Wierzchołek | Czas odkrycia d[v] | Czas zakończenia f[v] | Poprzednik p[v]")
    print("-" * 70)
    for i in range(num_vertices):
        print(f"{i:<11} | {str(d_times[i]):<19} | {str(f_times[i]):<21} | {str(predecessors[i]):<15}")

    if not full_search:
        print("\n--- Wnioski z pojedynczego DFS ---")
        visited_count = sum(1 for c in colors if c != WHITE)
        if visited_count == num_vertices:
            print(f"Komentarz: Zadanego źródła ({start_node}) WYSTARCZYŁO do odwiedzenia całego grafu.")
        else:
            print(f"Komentarz: Zadanego źródła ({start_node}) NIE WYSTARCZYŁO do odwiedzenia całego grafu (odwiedzono {visited_count}/{num_vertices} wierzchołków).")
        print("Komentarz: Kolejność sąsiadów w liście sąsiedztwa (tutaj posortowana rosnąco) może wpływać na kolejność odwiedzin, a co za tym idzie, na czasy d i f, a także na strukturę drzewa przeszukiwania.")
    else:
        print("\n--- Wnioski z pełnego przeszukiwania DFS (DFS-PEŁNY) ---")
        print(f"Liczba uruchomień procedury DFS-WIZYTA: {num_dfs_visits}")
        for i, component in enumerate(dfs_trees):
            print(f"Drzewo DFS {i+1} (komponenta): {sorted(component)}")
        
        if num_dfs_visits > 1:
            print("Komentarz: Graf jest niespójny, ponieważ procedura DFS-WIZYTA została uruchomiona więcej niż raz.")
        else:
            print("Komentarz: Graf jest spójny, ponieważ procedura DFS-WIZYTA została uruchomiona tylko raz.")
        print("Komentarz: Wynik pełnego DFS obejmuje wszystkie wierzchołki grafu, niezależnie od spójności. W przeciwieństwie do DFS z pojedynczego źródła, które odwiedzi tylko wierzchołki osiągalne z tego źródła.")
    
    if classify:
        print("\n--- Klasyfikacja krawędzi (tylko dla grafów skierowanych) ---")
        if not graph.directed:
            print("Błąd: Klasyfikacja krawędzi ma sens tylko dla grafów skierowanych. Ten graf jest nieskierowany.")
        else:
            print("Krawędź (u, v) | Typ krawędzi")
            print("-" * 30)
            all_edges = graph.get_all_edges()
            # Sortujemy dla czytelności
            sorted_edges = sorted(all_edges, key=lambda x: (x[0], x[1]))
            for u, v, _ in sorted_edges:
                edge_type = edge_types.get((u, v), "Nie sklasyfikowana (np. poza komponentą startową DFS)")
                print(f"({u}, {v})       | {edge_type}")
            
            print("\n--- Wnioski z klasyfikacji krawędzi ---")
            if edge_types.get('has_back_edge', False):
                print("Komentarz: Wystąpiła krawędź POWROTNA. Oznacza to istnienie cyklu skierowanego w badanym grafie.")
            else:
                print("Komentarz: Nie znaleziono krawędzi POWROTNEJ. W badanym grafie skierowanym prawdopodobnie nie ma cykli.")
            print("Komentarz: Klasyfikacja krawędzi opiera się na stanach wierzchołków (kolorach) oraz czasach odkrycia i zakończenia. Krawędzie w przód łączą wierzchołek z jego potomkiem, który nie jest jego bezpośrednim dzieckiem w drzewie DFS. Krawędzie poprzeczne łączą wierzchołki, które nie są w relacji przodek-potomek i nie są krawędziami drzewowymi ani powrotnymi.")

    if topological_sort_mode:
        print("\n--- Sortowanie topologiczne ---")
        if edge_types.get('has_back_edge', False):
            print("Komentarz: Graf zawiera cykl (wykryto krawędź POWROTNĄ), dlatego sortowanie topologiczne NIE jest możliwe.")
            return None, None, None, None, None # Zwracamy None dla wyniku sortowania
        else:
            topo_list = steps_log['topo_list']
            print(f"Wynik sortowania topologicznego: {topo_list}")
            print("\n--- Wnioski z sortowania topologicznego ---")
            print("Komentarz: Dla każdego krawędzi (u, v) w posortowanej liście, wierzchołek u występuje przed v.")
            is_correct = True
            for u, v, _ in graph.get_all_edges():
                if topo_list.index(u) > topo_list.index(v):
                    is_correct = False
                    print(f"Błąd: Krawędź ({u}, {v}) narusza kolejność sortowania topologicznego (u={topo_list.index(u)} > v={topo_list.index(v)})!")
                    break
            if is_correct:
                print("Komentarz: Sprawdzono, że dla każdej krawędzi (u, v), u rzeczywiście występuje przed v w posortowanej liście.")
            print("Komentarz: Dodanie krawędzi tworzącej cykl (np. z powrotem do już odwiedzonego szarego wierzchołka) spowodowałoby wykrycie krawędzi powrotnej i uniemożliwiłoby sortowanie topologiczne.")

    return colors, d_times, f_times, predecessors, edge_types if classify else None, steps_log['topo_list'] if topological_sort_mode else None


# --- Klasa Zbiory Rozłączne (Disjoint Set Union) ---
class DisjointSetUnion:
    """
    Klasa implementująca strukturę danych Zbiorów Rozłącznych (Union-Find)
    z optymalizacją kompresji ścieżek i łączenia według rangi/wielkości.
    """
    def __init__(self, num_elements):
        self.parent = list(range(num_elements))
        self.rank = [0] * num_elements # Używamy rangi do optymalizacji łączenia

    def make_set(self, i):
        """Tworzy nowy zbiór dla elementu i."""
        self.parent[i] = i
        self.rank[i] = 0

    def find(self, i):
        """
        Znajduje reprezentanta zbioru zawierającego element i
        z kompresją ścieżek.
        """
        if self.parent[i] == i:
            return i
        self.parent[i] = self.find(self.parent[i]) # Kompresja ścieżek
        return self.parent[i]

    def union(self, i, j):
        """
        Łączy zbiory zawierające elementy i oraz j
        za pomocą łączenia według rangi.
        Zwraca True, jeśli zbiory zostały połączone, False jeśli były już w tym samym zbiorze.
        """
        root_i = self.find(i)
        root_j = self.find(j)

        if root_i != root_j:
            # Łączenie według rangi
            if self.rank[root_i] < self.rank[root_j]:
                self.parent[root_i] = root_j
            elif self.rank[root_i] > self.rank[root_j]:
                self.parent[root_j] = root_i
            else:
                self.parent[root_j] = root_i
                self.rank[root_i] += 1
            return True
        return False


# --- Algorytm Kruskala ---

def kruskal(graph):
    """
    Implementuje algorytm Kruskala do znajdowania Minimalnego Drzewa Rozpinającego (MST).
    Wymaga grafu ważonego, nieskierowanego.
    """
    if graph.directed:
        print("Błąd: Algorytm Kruskala działa tylko dla grafów nieskierowanych.")
        return None, None
    if not graph.weighted:
        print("Błąd: Algorytm Kruskala wymaga grafu ważonego.")
        return None, None

    num_vertices = graph.num_vertices
    mst_edges = []
    total_mst_weight = 0
    steps_log = []

    # 1. Inicjalizacja DSU
    dsu = DisjointSetUnion(num_vertices)
    for i in range(num_vertices):
        dsu.make_set(i)
        # steps_log.append(f"Inicjalizacja zbioru dla wierzchołka {i}.")

    # 2. Posortuj wszystkie krawędzie niemalejąco względem wagi
    all_edges = graph.get_all_edges()
    sorted_edges = sorted(all_edges, key=lambda x: x[2])
    steps_log.append(f"Wszystkie krawędzie posortowane wg wagi: {[(u,v,w) for u,v,w in sorted_edges]}")
    steps_log.append("\n--- Przebieg algorytmu Kruskala ---")

    # 3. Przeglądaj krawędzie w posortowanej kolejności
    for u, v, weight in sorted_edges:
        steps_log.append(f"Rozważam krawędź ({u}, {v}) z wagą {weight}. Reprezentant {u}: {dsu.find(u)}, Reprezentant {v}: {dsu.find(v)}.")
        if dsu.find(u) != dsu.find(v):
            dsu.union(u, v)
            mst_edges.append((u, v, weight))
            total_mst_weight += weight
            steps_log.append(f"  Dodaję krawędź ({u}, {v}) do MST. Zbiory połączone. Aktualna waga MST: {total_mst_weight}.")
        else:
            steps_log.append(f"  Odrzucam krawędź ({u}, {v}). Tworzy cykl (wierzchołki są już w tym samym zbiorze).")

    print("\n" + "="*50)
    print("--- DETALICZNY PRZEBIEG ALGORYTMU KRUSKALA ---")
    print("="*50)
    for step in steps_log:
        print(step)

    print("\n" + "="*50)
    print("--- PODSUMOWANIE WYNIKÓW ALGORYTMU KRUSKALA ---")
    print("="*50)
    print(f"Wybrane krawędzie MST: {sorted(mst_edges, key=lambda x: (x[0], x[1]))}")
    print(f"Całkowita waga MST: {total_mst_weight}")
    
    print("\n--- Wnioski z algorytmu Kruskala ---")
    expected_edges = num_vertices - 1
    if len(mst_edges) == expected_edges:
        print(f"Komentarz: Wynik zawiera dokładnie {expected_edges} krawędzi, zgodnie z oczekiwaniami dla drzewa rozpinającego {num_vertices} wierzchołków.")
    else:
        print(f"Komentarz: Wynik zawiera {len(mst_edges)} krawędzi, podczas gdy oczekiwano {expected_edges}. Może to wskazywać na graf niespójny lub błąd w implementacji.")
        if len(mst_edges) < expected_edges:
            print("Komentarz: Mniejsza liczba krawędzi niż V-1 dla grafu niespójnego jest poprawna, ponieważ algorytm Kruskala znajdzie MST dla każdej komponenty spójnej (las rozpinający).")
    print("Komentarz: Algorytm Kruskala buduje MST zachłannie, dodając najlżejsze krawędzie, które nie tworzą cyklu.")
    print("Komentarz: Struktura zbiorów rozłącznych (DSU) jest kluczowa dla efektywnego sprawdzania, czy krawędź łączy dwie różne składowe.")

    return mst_edges, total_mst_weight


# --- Funkcja główna do wyboru zadań ---
def main():
    while True:
        print("\n--- Wybierz zadanie ---")
        print("1. Przeszukiwanie w głąb (DFS) z jednego źródła")
        print("2. Pełne przeszukiwanie w głąb (DFS-PEŁNY)")
        print("3. Klasyfikacja krawędzi (dla DFS na grafie skierowanym)")
        print("4. Sortowanie topologiczne")
        print("5. Algorytm Kruskala (Minimalne Drzewo Rozpinające)")
        print("0. Wyjdź")

        choice = input("Wybierz opcję: ")

        if choice == '0':
            break

        if choice in ['1', '2', '3', '4', '5']:
            filename = input("Podaj ścieżkę do pliku z grafem: ")
            graph = Graph.load_from_file(filename)
            if graph is None:
                continue

            if choice == '1':
                try:
                    start_node = int(input(f"Podaj wierzchołek startowy (0 do {graph.num_vertices - 1}): "))
                    if not (0 <= start_node < graph.num_vertices):
                        raise ValueError
                    run_dfs(graph, start_node)
                except ValueError:
                    print(f"Nieprawidłowy wierzchołek startowy. Musi być liczbą całkowitą od 0 do {graph.num_vertices - 1}.")
            elif choice == '2':
                run_dfs(graph, 0, full_search=True) # start_node jest ignorowany
            elif choice == '3':
                if not graph.directed:
                    print("Klasyfikacja krawędzi ma sens tylko dla grafów skierowanych. Proszę wczytać graf skierowany.")
                    continue
                try:
                    start_node = int(input(f"Podaj wierzchołek startowy (0 do {graph.num_vertices - 1}): "))
                    if not (0 <= start_node < graph.num_vertices):
                        raise ValueError
                    # run_dfs z klasyfikacją, ale jako pełne przeszukiwanie, żeby sklasyfikować wszystkie krawędzie
                    # Można też uruchomić z jednego źródła, jeśli jest to cel
                    print("--- Uruchamiam pełne DFS do klasyfikacji krawędzi ---")
                    run_dfs(graph, start_node, full_search=True, classify=True)
                except ValueError:
                    print(f"Nieprawidłowy wierzchołek startowy. Musi być liczbą całkowitą od 0 do {graph.num_vertices - 1}.")
            elif choice == '4':
                run_dfs(graph, 0, full_search=True, classify=True, topological_sort_mode=True)
            elif choice == '5':
                kruskal(graph)
        else:
            print("Nieprawidłowa opcja. Spróbuj ponownie.")

if __name__ == "__main__":
    main()