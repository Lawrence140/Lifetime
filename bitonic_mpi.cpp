#include <mpi.h>
#include <iostream>
#include <vector>
#include <algorithm>
#include <random>
#include <queue>
#include <iomanip>
#include <fstream>

using namespace std;

//function prototypes
void bitonicMerge(vector<long long>& arr, int low, int cnt, bool dir);
void bitonicSortLocal(vector<long long>& arr, int low, int cnt, bool dir);
bool isSorted(const vector<long long>& arr);
void compareExchange(long long* local, int local_n, int partner, int rank, int dir, MPI_Comm comm);

//main
int main(int argc, char* argv[]) {
    MPI_Init(&argc, &argv);

    int world_rank, world_size;
    MPI_Comm_rank(MPI_COMM_WORLD, &world_rank);
    MPI_Comm_size(MPI_COMM_WORLD, &world_size);

    
    static ofstream csvFile;
    if (world_rank == 0) {
        csvFile.open("results(mpi).csv");
        if (!csvFile.is_open()) {
            cerr << "Error opening results(mpi).csv for writing\n";
            MPI_Abort(MPI_COMM_WORLD, 1);
        }
        csvFile << "Size,Processes,TimeSeconds\n";
    }

    vector<int> test_sizes = {16,32,64,128,256,512,1024, 4096, 16384, 65536, 262144, 1048576};

    vector<int> proc_counts;
    for (int p = 2; p <= world_size; p <<= 1) {
        proc_counts.push_back(p);
    }

    for (int p : proc_counts) {
        MPI_Comm sub_comm;
        int color = (world_rank < p) ? 1 : MPI_UNDEFINED;
        MPI_Comm_split(MPI_COMM_WORLD, color, world_rank, &sub_comm);

        if (world_rank < p) {
            int rank, size;
            MPI_Comm_rank(sub_comm, &rank);
            MPI_Comm_size(sub_comm, &size);

            for (int n : test_sizes) {
                if (n % size != 0) {
                    if (rank == 0) {
                        cout << "Skipping n = " << n << " as it's not divisible by process count " << size << endl;
                    }
                    continue;
                }

                int local_n = n / size;
                vector<long long> data;
                if (rank == 0) {
                    random_device rd;
                    mt19937_64 gen(rd());
                    uniform_int_distribution<long long> dis(0, 1000000000);

                    data.resize(n);
                    for (int i = 0; i < n; i++) data[i] = dis(gen);
                }

                vector<long long> local(local_n);

                MPI_Scatter(data.data(), local_n, MPI_LONG_LONG,
                            local.data(), local_n, MPI_LONG_LONG,
                            0, sub_comm);

                MPI_Barrier(sub_comm);
                double start = MPI_Wtime();

                bitonicSortLocal(local, 0, local_n, true);

                int stages = 0;
                for (int tmp = size; tmp > 1; tmp >>= 1) stages++;

                for (int stage = 0; stage < stages; stage++) {
                    for (int step = stage; step >= 0; step--) {
                        int partner = rank ^ (1 << step);
                        if (partner < size) {
                            int dir = ((rank >> (stage + 1)) & 1) == 0 ? 1 : 0;
                            compareExchange(local.data(), local_n, partner, rank, dir, sub_comm);
                        }
                        MPI_Barrier(sub_comm);
                    }
                }

                if (rank == 0) data.resize(n);
                MPI_Gather(local.data(), local_n, MPI_LONG_LONG,
                           data.data(), local_n, MPI_LONG_LONG,
                           0, sub_comm);

                MPI_Barrier(sub_comm);
                double end = MPI_Wtime();

                if (rank == 0) {
                    vector<long long> fully_sorted(n);
                    typedef pair<long long, pair<int,int>> HeapNode;
                    priority_queue<HeapNode, vector<HeapNode>, greater<HeapNode>> min_heap;
                    vector<int> indices(size, 0);

                    for (int i = 0; i < size; i++)
                        min_heap.push({data[i*local_n], {i, 0}});

                    int idx = 0;
                    while (!min_heap.empty()) {
                        auto [val, pos] = min_heap.top();
                        min_heap.pop();
                        fully_sorted[idx++] = val;
                        int chunk = pos.first;
                        int ind = pos.second + 1;
                        if (ind < local_n) {
                            min_heap.push({data[chunk*local_n + ind], {chunk, ind}});
                        }
                    }

                    bool sorted_correctly = isSorted(fully_sorted);

                    cout<< "Sorted n = "<< setw(9) << n << " using " << setw(2) << size << " process(es) in " << fixed << setprecision(6) << (end - start) << " sec. " << endl;
                            
                    if (rank == 0) {
                        csvFile << n << "," << size << "," << fixed << setprecision(6) << (end - start) << "\n";
                    csvFile.flush();
                    }
                }
            }
        }
        if (sub_comm != MPI_COMM_NULL)
            MPI_Comm_free(&sub_comm);
        MPI_Barrier(MPI_COMM_WORLD);
    }
    
    if (world_rank == 0) {
    csvFile.close();
    }
    MPI_Finalize();
    return 0;
}


/// @brief reccusively merges list and perform swaps
/// @param arr 
/// @param low 
/// @param cnt 
/// @param dir 
void bitonicMerge(vector<long long>& arr, int low, int cnt, bool dir) {
    if (cnt > 1) {
        int k = cnt / 2;
        for (int i = low; i < low + k; i++) {
            if (dir == (arr[i] > arr[i + k]))
                swap(arr[i], arr[i + k]);
        }
        bitonicMerge(arr, low, k, dir);
        bitonicMerge(arr, low + k, k, dir);
    }
}

/// @brief  reccusively sorts list and merges
/// @param arr 
/// @param low 
/// @param cnt 
/// @param dir 
void bitonicSortLocal(vector<long long>& arr, int low, int cnt, bool dir) {
    if (cnt > 1) {
        int k = cnt / 2;
        bitonicSortLocal(arr, low, k, true);
        bitonicSortLocal(arr, low + k, k, false);
        bitonicMerge(arr, low, cnt, dir);
    }
}

/// @brief checks if list is sorted
/// @param arr 
/// @return 
bool isSorted(const vector<long long>& arr) {
    for (size_t i = 1; i < arr.size(); i++) {
        if (arr[i] < arr[i - 1]) return false;
    }
    return true;
}

/// @brief comparare value and send to comm word via condition
/// @param local 
/// @param local_n 
/// @param partner 
/// @param rank 
/// @param dir 
/// @param comm 
/// @return 
void compareExchange(long long* local, int local_n, int partner, int rank, int dir, MPI_Comm comm) {
    vector<long long> recvbuf(local_n);
    MPI_Status status;

    MPI_Sendrecv(local, local_n, MPI_LONG_LONG, partner, 0,
                 recvbuf.data(), local_n, MPI_LONG_LONG, partner, 0,
                 comm, &status);

    if (dir == 1) { // ascending
        for (int i = 0; i < local_n; i++) {
            if (local[i] > recvbuf[i]) {
                swap(local[i], recvbuf[i]);
            }
        }
    } else { // descending
        for (int i = 0; i < local_n; i++) {
            if (local[i] < recvbuf[i]) {
                swap(local[i], recvbuf[i]);
            }
        }
    }

    MPI_Sendrecv(local, local_n, MPI_LONG_LONG, partner, 0,
                 recvbuf.data(), local_n, MPI_LONG_LONG, partner, 0,
                 comm, &status);

    copy(recvbuf.begin(), recvbuf.end(), local);
}