/* File:     fractal.cpp
 *
 * Purpose:  compute the Julia set fractals
 *
 * Compile:  g++ -g -Wall -fopenmp -o fractal fractal.cpp -lglut -lGL
 * Run:      ./fractal
 *
 */

#include <iostream>
#include <cstdlib>
#include "../common/cpu_bitmap.h"
#include <omp.h>
#include <iomanip>
#include <functional>
using namespace std;

#define DIM 768
/*Uncomment the following line for visualization of the bitmap*/
#define DISPLAY 1

struct cuComplex {
    float   r;
    float   i;
    cuComplex( float a, float b ) : r(a), i(b)  {}
    float magnitude2( void ) { return r * r + i * i; }
    cuComplex operator*(const cuComplex& a) {
        return cuComplex(r*a.r - i*a.i, i*a.r + r*a.i);
    }
    cuComplex operator+(const cuComplex& a) {
        return cuComplex(r+a.r, i+a.i);
    }
};

int julia( int x, int y ) { 
    const float scale = 1.5;
    float jx = scale * (float)(DIM/2 - x)/(DIM/2);
    float jy = scale * (float)(DIM/2 - y)/(DIM/2);

    //cuComplex c(-0.8, 0.156);
    cuComplex c(-0.7269, 0.1889);
    cuComplex a(jx, jy);

    int i = 0;
    for (i=0; i<300; i++) {
        a = a * a + c;
        if (a.magnitude2() > 1000)
            return 0;
    }

    return 1;
}


 /// @brief function for 1D Row wise parallel
 /// @param ptr 
 void kernel_omp_1D_rowWise_parallel(unsigned char * ptr,const int n){
    #pragma omp parallel num_threads(n)
    {
        int T = omp_get_num_threads();//get number of threads.
        int Tid = omp_get_thread_num();//get thread id.
        for(int y=Tid;y<DIM;y+=T){//assigns ith iteration row a thread to excute them. 
            for(int x=0;x<DIM;x++){// Normal looping over the cols no dependencies.
                int offset = x + y * DIM;
                int juliaValue = julia( x, y );
                ptr[offset*4 + 0] = 255 * juliaValue;
                ptr[offset*4 + 1] = 0;
                ptr[offset*4 + 2] = 0;
                ptr[offset*4 + 3] = 255;
            }
        }
    }
 }

 /// @brief  function for 1D Column wise parallel 
 /// @param ptr 
 void kernel_omp_1D_columnWise_parallel(unsigned char * ptr,const int n){
    #pragma omp parallel num_threads(n)
    {
        int T = omp_get_num_threads();//get number of threads.
        int Tid = omp_get_thread_num();//get thread id.
        for(int y=0;y<DIM;y++){// Normal looping over the rows.
            for(int x = Tid;x<DIM;x+=T){//assigns ith iteration col a thread to excute them, no dependencies.
                int offset = x + y * DIM;
                int juliaValue = julia( x, y );
                ptr[offset*4 + 0] = 255 * juliaValue;
                ptr[offset*4 + 1] = 0;
                ptr[offset*4 + 2] = 0;
                ptr[offset*4 + 3] = 255;
            }
        }
    }
 }


 /// @brief function for 2D row_block parallel
 /// @param ptr 
 void kernel_omp_2D_row_blockWise_parallel(unsigned char * ptr,const int n){
    #pragma omp parallel num_threads(16)//Start of parallel region number of thread can be changed as needed.
    {
        const int T = omp_get_num_threads();//get number of threads.
        int Tid = omp_get_thread_num();//get thread id.
        const int row_perThread = DIM/T;//gets number of rows a single thread will execute.
        const int remainder = DIM%T;//checks to see if therell be remaining rows.
        bool extra = 0; //sets value to 1->true if remaider found
        if(Tid<remainder){
            extra = 1;//found
        }
        else{
            extra = 0;//not found
        }
        int startRow;
        if(Tid<remainder){
            startRow = Tid*(row_perThread+1);//if found,shit the start row for low balancing.
        }
        else{
            startRow = Tid*row_perThread+remainder;
        }
        int endRow = startRow+row_perThread+(int)extra;
        for(int y=startRow;y<endRow;y++){//loop from start to end row to assign a thread rows to excute.
            for(int x=0;x<DIM;x++){// Normal looping over the cols no dependencies
                int offset = x + y * DIM;
                int juliaValue = julia( x, y );
                ptr[offset*4 + 0] = 255 * juliaValue;
                ptr[offset*4 + 1] = 0;
                ptr[offset*4 + 2] = 0;
                ptr[offset*4 + 3] = 255;
            }
        }
    }
 }

 /// @brief fuction for 2D column_block parallel
 /// @param ptr 
 void kernel_omp_2D_column_blockWise_parallel(unsigned char * ptr,const int n){
    #pragma omp parallel num_threads(n)//Start of parallel region number of thread can be changed as needed.
    {
        const int T = omp_get_num_threads();//get number of threads
        int Tid = omp_get_thread_num();//get thread id
        const int row_perThread = DIM/T;//gets number of cols a single thread will execute.
        const int remainder = DIM%T;//checks to see if therell be remaining cols.
        bool extra = 0; //sets value to 1->true if remaider found
        if(Tid<remainder){
            extra = 1;//found
        }
        else{
            extra = 0;//not found
        }
        int startCol;
        if(Tid<remainder){
            startCol = Tid*(row_perThread+1);//if found,shit the start row for low balancing.
        }
        else{
            startCol = Tid*row_perThread+remainder;
        }
        int endCol = startCol+row_perThread+(int)extra;;
        for(int y=0;y<DIM;y++){// Normal looping over the rows no dependencies
            for(int x=startCol;x<endCol;x++){//loop from start to end col to assign a thread rows to excute, no loop carried dependencies.
                int offset = x + y * DIM;
                int juliaValue = julia( x, y );
                ptr[offset*4 + 0] = 255 * juliaValue;
                ptr[offset*4 + 1] = 0;
                ptr[offset*4 + 2] = 0;
                ptr[offset*4 + 3] = 255;
            }
        }
    }
 }

/*Parallelize the following function using OpenMP*/
/// @brief function using for construct collapse and schedule clause
/// @param ptr 
void kernel_omp ( unsigned char *ptr,const int n){
    //start of parallel region with a specified number of threads and 2 for loops collapsed into a single for loop and a dynamic scheduling is used.
    #pragma omp parallel for num_threads(16) collapse(2) schedule(dynamic)
        for (int y=0; y<DIM; y++) {
            for (int x=0; x<DIM; x++) {
                int offset = x + y * DIM;
                int juliaValue = julia( x, y );
                ptr[offset*4 + 0] = 255 * juliaValue;
                ptr[offset*4 + 1] = 0;
                ptr[offset*4 + 2] = 0;
                ptr[offset*4 + 3] = 255;
            }
        }
 }

 void kernel_serial ( unsigned char *ptr ){
    for (int y=0; y<DIM; y++) {
        for (int x=0; x<DIM; x++) {
            int offset = x + y * DIM;

            int juliaValue = julia( x, y );
            ptr[offset*4 + 0] = 255 * juliaValue;
            ptr[offset*4 + 1] = 0;
            ptr[offset*4 + 2] = 0;
            ptr[offset*4 + 3] = 255;
        }
    }
 }

 /// @brief The function is used to take all the computation times for all parallel functions and then displays them in the the terminal
 /// @param name 
 /// @param kernelFunc 
 /// @param ptr 
 /// @param serialTimes 
 /// @param maxThreads 
 /// @param runTimes 
 /// @param speedups 
 void printerParallel(const string& name, function<void(unsigned char*, int)> kernelFunc,unsigned char* ptr, double* serialTimes, int maxThreads, double* runTimes, double* speedups) {    
    for (int i = 0; i < maxThreads; ++i) {
    int numThreads = i + 1;
    double start = omp_get_wtime();
    kernelFunc(ptr, numThreads);
    double elapsed = omp_get_wtime() - start;
    runTimes[i] = elapsed;
    speedups[i] = serialTimes[i] / elapsed;
    }
    // Output
    cout << "\n[" << name << "]" << endl;
    cout << left << setw(15) << "Threads" << setw(20) << "Time (s)" << "Speedup" << endl;
    for (int i = 0; i < maxThreads; ++i) {
    cout << left << setw(15) << (i + 1)<< setw(20) << runTimes[i]<< speedups[i] << endl;
    }
}

/// @brief The function is used to take  the computation times for the serial function and then display them in the the terminal
/// @param name 
/// @param kernelFunc 
/// @param ptr 
/// @param maxThreads 
/// @param runTimes 
void printerSerial(const string& name,function<void(unsigned char*)> kernelFunc,unsigned char* ptr, int maxThreads,double * runTimes){
    for(int i=0;i<maxThreads;i++){
        double start = omp_get_wtime();
        kernelFunc(ptr);
        double elapsed = omp_get_wtime()-start;
        runTimes[i] = elapsed;
    }
    cout << "\n[" << name << "]" << endl;
    cout << left << setw(15) << "Threads" << setw(20) << "Time (s)"<< endl;
    for (int i = 0; i < maxThreads; ++i) {
    cout << left << setw(15) << (i + 1)<< setw(20) << runTimes[i]<< endl;
    }
}

int main( void ) {
    CPUBitmap bitmap( DIM, DIM );
    unsigned char *ptr_s = bitmap.get_ptr();
    unsigned char *ptr_p = bitmap.get_ptr(); 
    int maxThreads = 16;

    double serialRun[16];
    for(int i=0;i<16;i++){
        double start_t = omp_get_wtime();
        kernel_serial(ptr_s);
        double end_t =  omp_get_wtime() - start_t;
        serialRun[i] = end_t;
    }
    printerSerial("Serial time",kernel_serial,ptr_p,maxThreads,serialRun);

//   for parallel functions
    double time1DR[maxThreads], speed1DR[maxThreads];
    double time1DC[maxThreads], speed1DC[maxThreads];
    double time2DRB[maxThreads], speed2DRB[maxThreads];
    double time2DCB[maxThreads], speed2DCB[maxThreads];
    double timeOMP[maxThreads], speedOMP[maxThreads];

//  printting parallel times and speedup
    printerParallel("1D Row-wise", kernel_omp_1D_rowWise_parallel, ptr_p, serialRun, maxThreads, time1DR, speed1DR);
    printerParallel("1D Column-wise", kernel_omp_1D_columnWise_parallel, ptr_p, serialRun, maxThreads, time1DC, speed1DC);
    printerParallel("2D Row-Block", kernel_omp_2D_row_blockWise_parallel, ptr_p, serialRun, maxThreads, time2DRB, speed2DRB);
    printerParallel("2D Column-Block", kernel_omp_2D_column_blockWise_parallel, ptr_p, serialRun, maxThreads, time2DCB, speed2DCB);
    printerParallel("OpenMP for construct", kernel_omp, ptr_p, serialRun, maxThreads, timeOMP, speedOMP);

    #ifdef DISPLAY     
    bitmap.display_and_exit();
    #endif
    return 0;
}