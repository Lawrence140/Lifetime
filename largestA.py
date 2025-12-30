# finding the largest value
import time
def largestA(list,N):
    largest = -1000000
    idx = 0
    while idx<N:
        if list[idx]>largest:
            largest = list[idx]
        idx+=1
    return largest

def main():
    myList = [18,17,21,33,42]
    start = time.perf_counter()
    result = largestA(myList,5)
    end = time.perf_counter() - start
    print(f"The largest is {result} found in {end}")

if __name__== "__main__":
    main()