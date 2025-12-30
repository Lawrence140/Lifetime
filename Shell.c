#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>
#include <unistd.h>
#include <sys/wait.h>
#include <string.h>
#include <assert.h>
#include <fcntl.h>

// define max sizes
#define MAX_TOKENS 50
#define MAX_PATHS 50

// helper prototype
void prep_line(char * line);

int main(int MainArgc, char *MainArgv[]){
	// Variables for the shell
	char * line = NULL;
	size_t len = 0;

	// An error message
	char error_message[30] = "An error has occurred\n";

	// Path list
	char * paths[MAX_PATHS];
	int path_count = 1;
	paths[0] = "/bin";

	// Batch mode
	if(MainArgc>1){
		// number of files passed
		if(MainArgc !=2){
			write(STDERR_FILENO,error_message,strlen(error_message));
			exit(1);
		}

		FILE *fp = fopen(MainArgv[1],"r");
		if (fp==NULL){
			write(STDERR_FILENO,error_message,strlen(error_message));
			exit(1);
		}
		bool should_exit = false;

		while (getline(&line,&len,fp)!=-1 && !should_exit){
			size_t line_len = strlen(line);
			if (line_len>0 && line[line_len-1]=='\n'){
				line[line_len-1] = '\0';
			}

			prep_line(line);

			char * multi_copy = strdup(line);
			char * single_cmd;
			pid_t pids[20];
			int pid_count = 0;

			while((single_cmd=strsep(&multi_copy,"&"))!=NULL){
				if(*single_cmd == '\0') continue;
				// Pasing commands in batch mode here
				char *argv[MAX_TOKENS];
				int i=0;
				char *line_copy = single_cmd;
				char * token;

				while((token=strsep(&line_copy," "))!=NULL){
					if (*token=='\0') continue;
					argv[i++] = token;
				}
				argv[i] = NULL;

				if(i==0) continue;
				// Excecuting commands

				// exit command
				if(strcmp(argv[0],"exit")==0){
					if(i!=1){
						write(STDERR_FILENO,error_message,strlen(error_message));
						continue;
					}
					should_exit = true;
					break;
				}


				// change directory command
				if(strcmp(argv[0],"cd")==0){
					if(i!=2 || chdir(argv[1])!=0){
						write(STDERR_FILENO,error_message,strlen(error_message));
					}
					continue;
				}

				// path command
				if (strcmp(argv[0],"path")==0){
					path_count = 0;
					for (int j = 1; j < i && path_count<MAX_PATHS; j++){
						paths[path_count++] = argv[j];
					}
					continue;
				}
				// redirection command
				char *outfile = NULL;
				int redirect_index = -1;
				for (int j = 0; j < i; j++){
					if(strcmp(argv[j],">")==0){
						if (redirect_index!=-1 || j+1>=i){
							write(STDERR_FILENO,error_message,strlen(error_message));
							redirect_index = -2;
							break;
						}
						redirect_index = j;
						outfile = argv[j+1];
					}
				}
				if(redirect_index==-2) continue;

				// check for mutilple aguments
				if (redirect_index != -1 && i > redirect_index + 2) {
 				   write(STDERR_FILENO, error_message, strlen(error_message));
    				continue;
				}

				if(redirect_index!=-1) argv[redirect_index] = NULL;

				// resolve executable
				char resolved[512];
				bool found = false;
				for(int j=0;j<path_count;j++){
					snprintf(resolved,sizeof(resolved),"%s/%s",paths[j],argv[0]);
					if(access(resolved,X_OK)==0){
						found = true;
						break;
					}
				}
				if (!found){
					write(STDERR_FILENO,error_message,strlen(error_message));
					continue;
				}

				// fork and execute
				pid_t pid = fork();
				if(pid<0){
					write(STDERR_FILENO,error_message,strlen(error_message));
					continue;
				}
				else if (pid==0){
					if(outfile!=NULL){
						int fd = open(outfile,O_CREAT|O_TRUNC|O_WRONLY,0644);
						if(fd<0){
							write(STDERR_FILENO,error_message,strlen(error_message));
							_exit(1);
						}
						dup2(fd,STDOUT_FILENO);
						dup2(fd,STDERR_FILENO);
						close(fd);
					}
					execv(resolved,argv);
					write(STDERR_FILENO,error_message,strlen(error_message));
					_exit(1);
				}
				else{
					pids[pid_count++] = pid;
				}
			}
			for (int k = 0; k < pid_count; k++){
				waitpid(pids[k],NULL,0);
			}
			free(multi_copy);
		}
		fclose(fp);
		free(line);
		return 0;		
	}

	// Interactive mode

	bool should_exit = false;

	while (!should_exit){
		printf("witsshell> ");
		fflush(stdout);

		if (getline(&line,&len,stdin)!=-1){
			size_t line_len = strlen(line);
			if (line_len > 0 && line[line_len - 1] == '\n') {
                line[line_len - 1] = '\0';
            }

			// prep line
			prep_line(line);

			// Varibles to pass multiple comments
			char *multi_copy = strdup(line);
			char *single_cmd;
			pid_t pids[20];
			int pid_count = 0;

			while((single_cmd=strsep(&multi_copy,"&"))!=NULL){
				if(*single_cmd=='\0') continue;

				// Pasing commands in interactive mode here
				char *argv[MAX_TOKENS];
				int i = 0;
				char *line_copy = single_cmd;
				char * token;
				while((token = strsep(&line_copy," "))!=NULL){
					if(*token=='\0') continue;
					argv[i] = token;
					i++;
				}
				argv[i] = NULL;

				//Executing commands
				if (i ==0 ) continue; 
			
				//Built in commands
				
				// Exit command
				if(strcmp(argv[0],"exit")==0){
					if (i!=1){
						write(STDERR_FILENO,error_message,strlen(error_message));
						continue;
					}
					should_exit = true;
					break; 
				}

				// Change directory
				if(strcmp(argv[0],"cd")==0){
					if (i!=2){
						write(STDERR_FILENO,error_message,strlen(error_message));
						continue;
					}
					if (chdir(argv[1])!=0){
						write(STDERR_FILENO,error_message,strlen(error_message));
					}
					continue;
				}

				// Get path command
				if(strcmp(argv[0],"path")==0){
					path_count = 0;
					for (int j = 1; j < i && path_count< MAX_PATHS; j++){
						paths[path_count++] =argv[j];
					}
					if(path_count == 0){
						paths[0] = "/bin";
						path_count = 1;
					}
					continue;
				}

				// Checking for redirection
				char * outfile = NULL;
				int redirect_index = -1;
				for(int j=0;j<i;j++){
					if(strcmp(argv[j],">")==0){
						if (redirect_index !=-1 || j+1>=i){
						write(STDERR_FILENO,error_message,strlen(error_message));
							redirect_index = -2;
							break;
						}
						redirect_index = j;
						outfile = argv[j+1];
					}
				}				
				if (redirect_index == -2) continue;

				// check for mutilple aguments
				if (redirect_index != -1 && i > redirect_index + 2) {
 				   write(STDERR_FILENO, error_message, strlen(error_message));
    				continue;
				}
				if (redirect_index != -1) argv[redirect_index] = NULL;

				// Resolve command path
				char resolved[512];
				bool found = false;
				for (int j = 0; j < path_count; j++){
					snprintf(resolved,sizeof(resolved),"%s/%s",paths[j],argv[0]);
					if(access(resolved,X_OK) == 0){
						found = true;
						break; 
					}
				}
				if(!found){
						write(STDERR_FILENO,error_message,strlen(error_message));
					continue;
				}
				pid_t pid = fork();
				if (pid < 0){
						write(STDERR_FILENO,error_message,strlen(error_message));
					continue;
				}
				else if (pid == 0){
					// Handling redirection in child
					if(outfile!=NULL){
						int fd = open(outfile,O_CREAT | O_TRUNC | O_WRONLY,0644);
						if(fd<0){
							write(STDERR_FILENO,error_message,strlen(error_message));
							_exit(1);
						}
						dup2(fd,STDOUT_FILENO);
						dup2(fd,STDERR_FILENO);
						close(fd);
					}
					execv(resolved,argv);
					write(STDERR_FILENO,error_message,strlen(error_message));
					_exit(1);
				}
				else{
					pids[pid_count++] = pid;
				}
			}
			for (int k = 0; k < pid_count; k++){
				waitpid(pids[k],NULL,0);
			}
			free(multi_copy);
		}
		else{
			should_exit = true;
			exit(0);
		}
	}
	free(line);
	return 0 ;
}

// helper function(trim white spaces)
void prep_line(char * line){
	char temp[1024] = {0};
	int j = 0;
	for (int i = 0;line[i]; i++){
		if(line[i] == '>' || line[i] == '&'){
			if(j>0 && temp[j-1]!=' ') temp[j++]=' ';
			temp[j++] = line[i];
			if(line[i+1]!=' ') temp[j++]=' ';
		}
		else{
			temp[j++] = line[i];
		}
	}
	temp[j]='\0';
	strcpy(line,temp);
}