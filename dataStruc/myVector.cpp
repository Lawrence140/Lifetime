#include <iostream>
using namespace std;

class myVector{
// private varible to ensure vector works dynamically.
private:
    int n_items;
    int n_size; 
    int * head;
// where the public starts we even initialse the vector here.

public:
    myVector(){
        n_items = 0;
        n_size = 1;
        head = new int [n_size];
    }

    /// @brief 
    /// @return 
    bool empty(){
        if(n_items==0){
            return false;
        }
        return true;
    }

    /// @brief 
    /// @return 
    int size(){
        return n_items;
    }

    /// @brief 
    /// @param element 
    void push_back(int element){
            if(n_items==0){
                head[0] = element;
            }
            if(n_items>=n_size){
                reallocate(2*n_size);
            }
            head[n_items] = element;
            n_items++;
        }

    /// @brief 
    void pop_back(){
        if(n_items==0) throw runtime_error("Cannot remove from an empty list");
        n_items--;
    } 

    /// @brief 
    /// @param element 
    void push_front(int element){
        if(n_items==0 || head==nullptr){
            push_back(element);
        }
        if(n_items>=n_size){
            reallocate(2*n_size);
        }
        // move all elemnts to right then push right and place
        int * temp = new int [n_size];
        for(int i=0;i<n_items;i++){
            temp[i+1] = head[i];
        }
        temp[0] = element;
        delete [] head;
        head = temp;
        n_items++;
    }

    /// @brief 
    void pop_front(){
        if(n_items==0) throw runtime_error("Cannot remove from an empty list.");
        for(int i=0;i<n_items;i++){
            head[i] = head[i+1];
        }
        n_items--;
    }

    /// @brief 
    /// @param idx 
    /// @param element 
    void insertAt(int idx, int element){
        if(idx>=n_items) push_back(element);
        if(n_items>=n_size) reallocate(2*n_size);
        
        else{
            int *temp = new  int[n_size];
            for(int i = 0;i<idx;i++){
                temp[i] = head[i];
            }
            temp[idx] = element;
            for (int i = idx+1; i < n_items; i++){
                temp[i] = head[i];
            }
            delete [] head;
            head = temp;
            n_items++;
        }
    }

    /// @brief 
    /// @param NewSize 
    void reallocate(int NewSize){
        int * temp = new int [NewSize];
        for(int i = 0; i < n_items; i++){
            temp[i] = head[i];
        }
        delete []  head;
        head = temp;
        n_size = NewSize;
    }

    /// @brief 
    void printer() {
        if (n_items == 0) {
            cout << "List is empty" << endl;
            return;
        }
        for (int i = 0; i < n_items; i++) {
            cout << head[i];
            if (i != n_items - 1) {
                cout << ",";
            }
        }
        cout << endl;
    }
};
