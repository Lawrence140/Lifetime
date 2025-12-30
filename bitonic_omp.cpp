#include <iostream>
#include <omp.h>
#include <iomanip>
#include <algorithm>
#include <utility>
#include <random>
#include <fstream>
using namespace std;

//sort functions
void BitonicMergeOMP(long long * list,int low,long long size,bool dir,long long taskCutOf);
void BitonicSortOMP(long long * list,int low,long long size,bool dir,long long taskCutOf);

//helper functions
long long * makeHugeList(long long n);
bool isSorted(long long *list,long long size);

int main(){

    cout<<"Maximum Elements in list  2^20 = 1,048,576."<<endl;

    ofstream csvFile("results(omp).csv");
    if (!csvFile.is_open()) {
        cerr << "Error opening results(omp).csv." << endl;
        return 1;
    }

    csvFile << "Size,Threads,TimeSeconds\n";

    long long maxSize = 1048576;
    srand(0);
    for (long long sizes = 2; sizes <= maxSize; sizes*=2){
        long long size = sizes; 
        long long * arr = new long long[size];
        long long * orig = makeHugeList(size);
        cout<<"Made list :)"<<" of size "<<size<<endl;

        omp_set_dynamic(0);     
        omp_set_nested(0);       

        cout<<"Sorting might take a while ;) ..."<<endl;

        for(int i = 1;i<=omp_get_max_threads();i++){
            int nThreads = i;
            copy(orig,orig+size,arr);

            long long taskCutOf = max(1024LL,size/(nThreads*12));   
            
            //sort in omp
            double start=omp_get_wtime(),end;
            #pragma omp parallel num_threads(nThreads)
            {   
                #pragma omp single
                {
                    BitonicSortOMP(arr,0,size,true,taskCutOf);
                }
            }
            end = omp_get_wtime();
            if (!isSorted(arr,size)) cerr<<"Fail to sort list overhead problem!"; 
            cout<<fixed<<setprecision(7)<<"Sorted list with "<<size<<" elements in === "<<end-start<<'\t'<<" using === "<<nThreads<<" thread(s)"<<endl;
            // Write results to CSV
            csvFile << size << "," << nThreads << "," << end-start << "\n";
        }
        cout<<defaultfloat;
        delete[] arr;
        delete [] orig;
    }
    csvFile.close();
    return 0;
}

/// @brief the functions creates a array of random long long 
/// @param n 
/// @return n array of long long
long long * makeHugeList(long long n){
    long long * arr =  new long long [n];
    //Random number generator setup
    random_device rd;
    mt19937 gen(rd());                     
    uniform_int_distribution<long long> dis(0, 1'000'000);
    for(int i=0;i<n;i++){
        arr[i] = dis(gen);
    }
    return arr;
}

/// @brief the function is to verify if list is sorted not really needed :(
/// @param list 
/// @param size 
/// @return 
bool isSorted(long long *list,long long size){
    for(long long i = 0;i<size-1;i++){
        if (list[i]>list[i+1]){
            return false;
        }
    }
    return true;
}

/// @brief reccursivly spilt list into 2 and make monotonic-(increasing and decreasing) then compare inc[i] dec[i] to n and use the swap function then merge the two.  
/// @param list 
/// @param low 
/// @param size 
/// @param dir 
/// @param taskCutOf 
void BitonicMergeOMP(long long * list,int low,long long size,bool dir,long long taskCutOf){
    //Base case
    if (size<=1) return;
    //Find midpoint
    long long k = size/2;
    //Compare left and right side of mid point and swap 
    for(long long i = low;i<(low+k);i++){
        if(dir == (list[i]>list[i+k])){
            swap(list[i], list[i+k]);
        }
    }
    //task is good for reccursion threshold for tasks(2^10) 
    //lower end 
    #pragma omp task if(size>taskCutOf)
        BitonicMergeOMP(list,low,k,dir,taskCutOf);
    //upper end
    #pragma omp task if(size>taskCutOf)
        BitonicMergeOMP(list,low+k,k,dir,taskCutOf);
    //synchronize tasks
    #pragma omp taskwait
}

/// @brief reccursivly spilt list into 2 and make monotonic-(increasing and decreasing) then sort the two, and merge the two.  
/// @param list 
/// @param low 
/// @param size 
/// @param dir 
/// @param taskCutOf 
void BitonicSortOMP(long long * list,int low,long long size,bool dir,long long taskCutOf){
    //Base case
    if (size<=1) return;

    //Find mid point
    long long k = size/2;

    //sort lower end
    #pragma omp task if(size>taskCutOf)
        BitonicSortOMP(list,low,k,true,taskCutOf);

    //sort upper end
    #pragma omp task if(size>taskCutOf)
        BitonicSortOMP(list,low+k,k,false,taskCutOf);

    //marge upper and lower end in 1 dir
    #pragma omp taskwait       
        BitonicMergeOMP(list,low,size,dir,taskCutOf);
}