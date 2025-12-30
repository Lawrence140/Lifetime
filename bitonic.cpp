#include <iostream>
#include <chrono>
#include <omp.h>
#include <iomanip>
#include <fstream>
using namespace std;
using namespace std::chrono;

//sort helper functions
void BitonicMerge(int * list,int low,int count,bool dir);
void BitonicSort(int * list,int low,int count,bool dir);
void swap(int * list,int thiss,int that);


//bulid helper functions
int * makeHugeList(int n);
bool isPowerOf2(int n);
bool isSorted(int* list,int size);

int main(){
    ofstream csvFile("result(Serial).csv");
    if (!csvFile.is_open()) {
        cerr << "Failed to open results(Serial).csv" << endl;
        return 1;
    }
    csvFile << "Size,TimeTaken\n";
    cout<<"Dynamic list for number of elements max at 2^20 = 1,048,576"<<endl;
    long long maxSize = 1048576;
    for(long long sizes=2;sizes<=maxSize;sizes*=2){
        long long size=sizes;
        int *arr;
        if(isPowerOf2(size))
        {
            arr = makeHugeList(size);
        }
        else{
            cerr<<"Size must be power of 2"<<endl;
            return 1;
        }
        double start = omp_get_wtime(),end;
        BitonicSort(arr,0,size,true);
        end = omp_get_wtime();
        if(!isSorted(arr,size)) cerr <<"Error was encounter while sorting list list. Please retry"<<endl;
        cout<<fixed<<setprecision(7)<<"Sorted a list with \t"<<"==="<<size<<" in \t"<<"==="<<end-start<<" seconds"<<endl;

        csvFile<<size<<","<<end-start<<"\n";
        delete[] arr;
    }
    csvFile.close();

    return 0;
}

/// @brief returns a list of size n
/// @param n 
/// @return 
int * makeHugeList(int n){
    int * arr =  new int [n];
    for(int i=0;i<n;i++){
        arr[i]=rand()%1000;
    }
    return arr;
}

/// @brief check is list of size is sorted
/// @param list 
/// @param size 
/// @return 
bool isSorted(int * list,int size){
    for(int i =0;i<size-1;i++){
        if(list[i]>list[i+1]) return false;
    }
    return true;
}

/// @brief swap elements an idx i and j in the list 
/// @param list 
/// @param i 
/// @param j 
void swap(int * list,int i,int j){
    int temp = list[i];
    list[i] = list[j];
    list[j] = temp;
    return;
}

/// @brief ruccrsively merges list after swaping
/// @param list 
/// @param low 
/// @param size 
/// @param dir 
void BitonicMerge(int * list,int low,int size,bool dir){
    //base case
    if (size<=1) return;
    //duvide in 2
    int k = size/2;
    //compare adn swap
    for(int i = low;i<(low+k);i++){
        if(dir == (list[i]>list[i+k])){
            swap(list,i,i+k);
        }
    }
    BitonicMerge(list,low,k,dir);
    BitonicMerge(list,low+k,k,dir);
}

/// @brief reccursivly sorts lists and merges it
/// @param list 
/// @param low 
/// @param size 
/// @param dir 
void BitonicSort(int * list,int low,int size,bool dir){
    if (size<=1) return;

    //divede in 2
    int k = size/2;

    //increasing
    BitonicSort(list,low,k,true);
    //decreading
    BitonicSort(list,low+k,k,false);
    //marge lists       
    BitonicMerge(list,low,size,dir);
}

/// @brief check if n is power of 2
/// @param n 
/// @return 
bool isPowerOf2(int n) {
    if (n <= 0) return false;
    while (n > 1) {
        if (n % 2 != 0) return false;
        n /= 2;
    }
    return true;
}