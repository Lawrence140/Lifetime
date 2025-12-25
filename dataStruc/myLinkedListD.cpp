#include <iostream>

using namespace std;


class node{
public:
    int value;
    node* next = nullptr;
    node* prev = nullptr;
};

class myLinkedList{
private:
    node* head;
    node* tail;
    int n_items;
public:
    myLinkedList(){
        head = nullptr;
        n_items = 0;

    }
    // my public methods goes here
};